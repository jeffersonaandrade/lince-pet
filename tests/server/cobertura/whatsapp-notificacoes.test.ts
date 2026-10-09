import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Prisma } from '@prisma/client'

const prismaMock = vi.hoisted(() => ({
  agendamento: { findUnique: vi.fn() },
  subscriptionPlan: { findUnique: vi.fn() },
  whatsappEnvio: { create: vi.fn(), update: vi.fn() },
}))
vi.mock('@/server/db', () => ({ prisma: prismaMock }))

const enviarMock = vi.hoisted(() => vi.fn())
vi.mock('@/server/services/whatsapp', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/server/services/whatsapp')>()
  return {
    ...original,
    providerAtual: () => ({ nome: 'fake', enviar: enviarMock }),
    enviarComRetry: (p: Parameters<typeof original.enviarComRetry>[0], to: string, texto: string) =>
      original.enviarComRetry(p, to, texto, 0),
  }
})

import {
  carregarAgendamento,
  notificarAgendamento,
  notificarTutorAvulso,
  planoPermiteWhatsapp,
  referenciaDaConsulta,
} from '@/server/services/whatsapp-notificacoes'

const PLANOS: Record<string, string[]> = { free: [], none: [], pro: ['whatsapp_notifications'], clinic: ['whatsapp_notifications'] }

const userTutor = { nome: 'Ana', sobrenome: 'Lima', celular: '(81) 99999-0000', notificarWhatsapp: 1 }

function consulta(over: Record<string, unknown> = {}) {
  return {
    id: 'ag-1',
    dataConsulta: '2026-10-10',
    horarioConsulta: '14:00',
    localNome: null,
    localEndereco: null,
    tipoConsulta: null,
    tutor: { id: 't1', user: userTutor },
    pet: { nome: 'Rex' },
    veterinario: { id: 'v1', subscriptionPlanCode: 'pro', user: { nome: 'João', sobrenome: null, celular: '81988887777' } },
    prestador: null,
    servicoOferecido: null,
    clinica: null,
    ...over,
  } as never
}

function pedido(over: Record<string, unknown> = {}) {
  return consulta({
    veterinario: null,
    prestador: {
      id: 'p1',
      subscriptionPlanCode: 'pro',
      user: { nome: 'Bia', sobrenome: null, celular: '81977776666' },
      tipoServico: { nome: 'Banho e tosa' },
    },
    servicoOferecido: { nome: 'Banho completo' },
    ...over,
  })
}

const registro = (i = 0) => prismaMock.whatsappEnvio.create.mock.calls[i][0].data

beforeEach(() => {
  vi.clearAllMocks()
  vi.spyOn(console, 'error').mockImplementation(() => {})
  prismaMock.subscriptionPlan.findUnique.mockImplementation(({ where }: { where: { code: string } }) =>
    Promise.resolve({ features: PLANOS[where.code] ?? [] })
  )
  prismaMock.whatsappEnvio.create.mockImplementation(({ data }: { data: object }) => Promise.resolve({ id: 'envio-1', ...data }))
  prismaMock.whatsappEnvio.update.mockResolvedValue({})
  enviarMock.mockResolvedValue({ id: 'msg-1' })
})

describe('carregarAgendamento e referência', () => {
  it('carrega com tutor, pet, vet, prestador, serviço e clínica', async () => {
    prismaMock.agendamento.findUnique.mockResolvedValueOnce({ id: 'ag-1' })
    await carregarAgendamento('ag-1')
    const arg = prismaMock.agendamento.findUnique.mock.calls[0][0]
    expect(arg.where).toEqual({ id: 'ag-1' })
    expect(Object.keys(arg.include).sort()).toEqual(['clinica', 'pet', 'prestador', 'servicoOferecido', 'tutor', 'veterinario'])
  })

  it('referência usa só a data (10 chars) + hora; sem dados vira vazia', () => {
    expect(referenciaDaConsulta({ dataConsulta: '2026-10-10T00:00:00', horarioConsulta: '09:30' })).toBe('2026-10-10 09:30')
    expect(referenciaDaConsulta({ dataConsulta: null, horarioConsulta: null } as never)).toBe('')
  })
})

describe('planoPermiteWhatsapp', () => {
  it('vet, prestador ou clínica com whatsapp_notifications liberam', async () => {
    expect(await planoPermiteWhatsapp(consulta())).toBe(true)
    expect(await planoPermiteWhatsapp(pedido())).toBe(true)
    expect(
      await planoPermiteWhatsapp(
        consulta({ veterinario: { subscriptionPlanCode: 'free', user: null }, clinica: { subscriptionPlanCode: 'clinic' } })
      )
    ).toBe(true)
  })

  it('ninguém com a feature (ou sem vet/prestador/clínica): false', async () => {
    expect(await planoPermiteWhatsapp(pedido({ prestador: { subscriptionPlanCode: 'free', user: null } }))).toBe(false)
    expect(await planoPermiteWhatsapp(consulta({ veterinario: null }))).toBe(false)
  })
})

describe('notificarAgendamento: pedido de prestador', () => {
  it('prestador com plano recebe o novo pedido com texto de serviço (sem "consulta" nem "Dr(a).")', async () => {
    const r = await notificarAgendamento('novo_agendamento', pedido(), ['profissional'])
    expect(r).toEqual({ profissional: 'enviado' })
    const [to, texto] = enviarMock.mock.calls[0]
    expect(to).toBe('5581977776666')
    expect(texto).toContain('Novo pedido de Ana Lima: "Banho completo"')
    expect(texto).not.toMatch(/consulta|Dr\(a\)/)
    expect(registro()).toMatchObject({ destinatario: 'profissional', evento: 'novo_agendamento', status: 'processando', tentativas: 0 })
  })

  it('sem serviço oferecido usa o nome do tipo de serviço; sem tipo, "Serviço"', async () => {
    await notificarAgendamento('confirmacao', pedido({ servicoOferecido: null }), ['tutor'])
    expect(enviarMock.mock.calls[0][1]).toContain('"Banho e tosa"')

    await notificarAgendamento(
      'confirmacao',
      pedido({ servicoOferecido: null, prestador: { subscriptionPlanCode: 'pro', user: null, tipoServico: null } }),
      ['tutor']
    )
    expect(enviarMock.mock.calls[1][1]).toContain('"Serviço"')
  })

  it('prestador sem plano com WhatsApp: ignorado/sem_plano', async () => {
    const r = await notificarAgendamento(
      'novo_agendamento',
      pedido({ prestador: { subscriptionPlanCode: 'free', user: { nome: 'Bia', sobrenome: null, celular: '81977776666' } } }),
      ['profissional']
    )
    expect(r.profissional).toBe('ignorado')
    expect(registro()).toMatchObject({ status: 'ignorado', motivo: 'sem_plano' })
    expect(enviarMock).not.toHaveBeenCalled()
  })
})

describe('notificarAgendamento: destinatário e dados', () => {
  it('vet sem celular recebe pelo WhatsApp da clínica', async () => {
    const a = consulta({
      veterinario: { subscriptionPlanCode: 'pro', user: { nome: 'João', sobrenome: null, celular: null } },
      clinica: { subscriptionPlanCode: 'free', whatsapp: '81955554444', nomeClinica: 'C' },
    })
    expect((await notificarAgendamento('novo_agendamento', a, ['profissional'])).profissional).toBe('enviado')
    expect(enviarMock.mock.calls[0][0]).toBe('5581955554444')
  })

  it('sem celular válido: ignorado/sem_celular, sem chamar o provedor', async () => {
    const a = consulta({ tutor: { user: { ...userTutor, celular: '123' } } })
    expect((await notificarAgendamento('confirmacao', a, ['tutor'])).tutor).toBe('ignorado')
    expect(registro()).toMatchObject({ status: 'ignorado', motivo: 'sem_celular', telefone: null })
    expect(enviarMock).not.toHaveBeenCalled()
  })

  it('tutor sem user: sem celular e texto com nome padrão', async () => {
    const a = consulta({ tutor: null })
    expect((await notificarAgendamento('confirmacao', a, ['tutor'])).tutor).toBe('ignorado')
    expect(registro()).toMatchObject({ motivo: 'sem_celular' })
  })

  it('local cai para endereço, tipo de consulta e "a combinar"; pet sem nome vira "seu pet"', async () => {
    await notificarAgendamento('confirmacao', consulta({ localEndereco: 'Rua A, 1' }), ['tutor'])
    expect(enviarMock.mock.calls[0][1]).toContain('📍 Local: Rua A, 1')

    await notificarAgendamento('confirmacao', consulta({ tipoConsulta: 'online' }), ['tutor'])
    expect(enviarMock.mock.calls[1][1]).toContain('📍 Local: online')

    await notificarAgendamento('lembrete_24h', consulta({ pet: null, dataConsulta: null, horarioConsulta: null }), ['tutor'])
    const texto = enviarMock.mock.calls[2][1]
    expect(texto).toContain('📍 Local: a combinar')
    expect(texto).toContain('🐾 Pet: seu pet')
    expect(texto).toContain('📅 Data: \n')
  })

  it('cancelamento por bloqueio leva o motivo ao tutor', async () => {
    await notificarAgendamento('cancelamento', consulta(), ['tutor'], { motivo: 'Cirurgia de emergência' })
    expect(enviarMock.mock.calls[0][1]).toContain('Motivo: Cirurgia de emergência')
  })

  it('aceita id: carrega o agendamento; id inexistente não envia nada', async () => {
    prismaMock.agendamento.findUnique.mockResolvedValueOnce(consulta())
    expect(await notificarAgendamento('confirmacao', 'ag-1', ['tutor'])).toEqual({ tutor: 'enviado' })

    prismaMock.agendamento.findUnique.mockResolvedValueOnce(null)
    expect(await notificarAgendamento('confirmacao', 'ag-x', ['tutor'])).toEqual({})
  })

  it('erro inesperado ao registrar um destinatário vira "falhou" e não impede o outro', async () => {
    prismaMock.whatsappEnvio.create.mockRejectedValueOnce(new Error('db down'))
    const r = await notificarAgendamento('remarcacao', consulta(), ['tutor', 'profissional'])
    expect(r).toEqual({ tutor: 'falhou', profissional: 'enviado' })
    expect(enviarMock).toHaveBeenCalledTimes(1)
  })

  it('registro ignorado já existente (unique) devolve duplicado', async () => {
    prismaMock.whatsappEnvio.create.mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError('Unique', { code: 'P2002', clientVersion: 'test' })
    )
    const a = consulta({ veterinario: { subscriptionPlanCode: 'free', user: null } })
    expect((await notificarAgendamento('confirmacao', a, ['tutor'])).tutor).toBe('duplicado')
  })

  it('erro do Prisma que não é unique é tratado como falha', async () => {
    prismaMock.whatsappEnvio.create.mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError('FK', { code: 'P2003', clientVersion: 'test' })
    )
    expect((await notificarAgendamento('confirmacao', consulta(), ['tutor'])).tutor).toBe('falhou')
  })

  it('envio sem id do provedor grava providerMessageId null', async () => {
    enviarMock.mockResolvedValueOnce({})
    await notificarAgendamento('confirmacao', consulta(), ['tutor'])
    expect(prismaMock.whatsappEnvio.update.mock.calls[0][0]).toMatchObject({
      where: { id: registro().id },
      data: { status: 'enviado', providerMessageId: null, provider: 'fake', tentativas: 1 },
    })
  })
})

describe('notificarTutorAvulso', () => {
  it('envia o texto avulso ao tutor, cortando evento (30) e referência (20)', async () => {
    prismaMock.agendamento.findUnique.mockResolvedValueOnce(consulta())
    const evento = 'encaminhamento_aceito_' + 'x'.repeat(20)
    const r = await notificarTutorAvulso('ag-1', evento, 'enc-123456789012345678901234', 'Seu encaminhamento foi aceito')
    expect(r).toBe('enviado')
    expect(registro()).toMatchObject({
      agendamentoId: 'ag-1',
      destinatario: 'tutor',
      evento: evento.slice(0, 30),
      referencia: 'enc-1234567890123456',
    })
    expect(enviarMock).toHaveBeenCalledWith('5581999990000', 'Seu encaminhamento foi aceito')
  })

  it('agendamento inexistente: nao_aplicavel', async () => {
    prismaMock.agendamento.findUnique.mockResolvedValueOnce(null)
    expect(await notificarTutorAvulso('ag-x', 'e', 'r', 't')).toBe('nao_aplicavel')
    expect(prismaMock.whatsappEnvio.create).not.toHaveBeenCalled()
  })

  it('respeita plano e opt-out do tutor', async () => {
    prismaMock.agendamento.findUnique.mockResolvedValueOnce(consulta({ veterinario: { subscriptionPlanCode: 'free', user: null } }))
    expect(await notificarTutorAvulso('ag-1', 'e', 'r', 't')).toBe('ignorado')
    expect(registro(0)).toMatchObject({ motivo: 'sem_plano' })

    prismaMock.agendamento.findUnique.mockResolvedValueOnce(consulta({ tutor: { user: { ...userTutor, notificarWhatsapp: 0 } } }))
    expect(await notificarTutorAvulso('ag-1', 'e', 'r2', 't')).toBe('ignorado')
    expect(registro(1)).toMatchObject({ motivo: 'opt_out' })
    expect(enviarMock).not.toHaveBeenCalled()
  })

  it('erro de banco não lança: devolve falhou', async () => {
    prismaMock.agendamento.findUnique.mockRejectedValueOnce(new Error('db down'))
    expect(await notificarTutorAvulso('ag-1', 'e', 'r', 't')).toBe('falhou')
    expect(console.error).toHaveBeenCalled()
  })
})
