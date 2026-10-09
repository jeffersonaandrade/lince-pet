import { describe, it, expect, vi, beforeEach } from 'vitest'
import { DateTime } from 'luxon'
import { Prisma } from '@prisma/client'

const prismaMock = vi.hoisted(() => ({
  agendamento: { findUnique: vi.fn(), findMany: vi.fn() },
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

import { WhatsAppError, enviarComRetry, normalizarTelefoneE164 } from '@/server/services/whatsapp'
import { notificarAgendamento, referenciaDaConsulta } from '@/server/services/whatsapp-notificacoes'
import { cronAutorizado, lembreteDevido, processarLembretes } from '@/server/services/whatsapp-lembretes'
import { inicioDaConsulta } from '@/server/services/agendamentos'

const PLANOS: Record<string, string[]> = { free: [], pro: ['whatsapp_notifications'], clinic: ['whatsapp_notifications'] }

function agendamento(over: Record<string, unknown> = {}) {
  return {
    id: 'ag-1',
    dataConsulta: '2026-10-10',
    horarioConsulta: '14:00',
    localNome: 'Clínica Centro',
    localEndereco: null,
    tipoConsulta: 'presencial',
    createdAt: new Date('2026-10-01T12:00:00Z'),
    tutor: { id: 't1', user: { nome: 'Ana', sobrenome: 'Lima', celular: '(81) 99999-0000', notificarWhatsapp: 1 } },
    pet: { nome: 'Rex' },
    veterinario: { id: 'v1', subscriptionPlanCode: 'pro', user: { nome: 'Dr. João', sobrenome: null, celular: '81988887777' } },
    clinica: null,
    ...over,
  }
}

const duplicado = () =>
  new Prisma.PrismaClientKnownRequestError('Unique constraint', { code: 'P2002', clientVersion: 'test' })

beforeEach(() => {
  vi.clearAllMocks()
  prismaMock.subscriptionPlan.findUnique.mockImplementation(({ where }: { where: { code: string } }) => ({
    features: PLANOS[where.code] ?? [],
  }))
  prismaMock.whatsappEnvio.create.mockImplementation(({ data }: { data: object }) => ({ id: 'envio-1', ...data }))
  prismaMock.whatsappEnvio.update.mockResolvedValue({})
  enviarMock.mockResolvedValue({ id: 'msg-1' })
})

describe('normalizarTelefoneE164', () => {
  it('converte celular BR com ou sem máscara/DDI', () => {
    expect(normalizarTelefoneE164('(81) 99999-0000')).toBe('5581999990000')
    expect(normalizarTelefoneE164('+55 81 99999-0000')).toBe('5581999990000')
    expect(normalizarTelefoneE164('8133334444')).toBe('558133334444')
  })
  it('retorna null para inválidos', () => {
    expect(normalizarTelefoneE164('123')).toBeNull()
    expect(normalizarTelefoneE164(null)).toBeNull()
  })
})

describe('enviarComRetry', () => {
  it('repete só em erro temporário', async () => {
    const temporario = { nome: 'x', enviar: vi.fn().mockRejectedValueOnce(new WhatsAppError('503', true)).mockResolvedValue({ id: 'ok' }) }
    await expect(enviarComRetry(temporario, '55', 't', 0)).resolves.toMatchObject({ ok: true, tentativas: 2 })

    const definitivo = { nome: 'x', enviar: vi.fn().mockRejectedValue(new WhatsAppError('400', false)) }
    await expect(enviarComRetry(definitivo, '55', 't', 0)).resolves.toMatchObject({ ok: false, tentativas: 1 })
    expect(definitivo.enviar).toHaveBeenCalledTimes(1)
  })
})

describe('notificarAgendamento', () => {
  it('plano com WhatsApp envia ao tutor com os dados da consulta e registra', async () => {
    const r = await notificarAgendamento('confirmacao', agendamento() as never, ['tutor'])
    expect(r.tutor).toBe('enviado')
    const [to, texto] = enviarMock.mock.calls[0]
    expect(to).toBe('5581999990000')
    expect(texto).toContain('Rex')
    expect(texto).toContain('10/10/2026')
    expect(texto).toContain('14:00')
    expect(texto).toContain('Clínica Centro')
    expect(prismaMock.whatsappEnvio.update.mock.calls[0][0].data).toMatchObject({ status: 'enviado', providerMessageId: 'msg-1' })
  })

  it('plano gratuito não envia e registra ignorado/sem_plano', async () => {
    const a = agendamento({ veterinario: { id: 'v1', subscriptionPlanCode: 'free', user: { nome: 'X', sobrenome: null, celular: '81988887777' } } })
    const r = await notificarAgendamento('confirmacao', a as never, ['tutor'])
    expect(r.tutor).toBe('ignorado')
    expect(enviarMock).not.toHaveBeenCalled()
    expect(prismaMock.whatsappEnvio.create.mock.calls[0][0].data).toMatchObject({ status: 'ignorado', motivo: 'sem_plano' })
  })

  it('vet grátis em clínica com plano envia', async () => {
    const a = agendamento({
      veterinario: { id: 'v1', subscriptionPlanCode: 'free', user: { nome: 'X', sobrenome: null, celular: '81988887777' } },
      clinica: { subscriptionPlanCode: 'clinic', whatsapp: null, nomeClinica: 'C' },
    })
    expect((await notificarAgendamento('confirmacao', a as never, ['tutor'])).tutor).toBe('enviado')
  })

  it('opt-out bloqueia o tutor, mas o profissional recebe', async () => {
    const a = agendamento({ tutor: { id: 't1', user: { nome: 'Ana', sobrenome: null, celular: '81999990000', notificarWhatsapp: 0 } } })
    const r = await notificarAgendamento('remarcacao', a as never, ['tutor', 'profissional'])
    expect(r).toEqual({ tutor: 'ignorado', profissional: 'enviado' })
    expect(enviarMock).toHaveBeenCalledTimes(1)
    expect(enviarMock.mock.calls[0][0]).toBe('5581988887777')
  })

  it('vet com WhatsApp desligado não recebe, nem pelo número da clínica', async () => {
    const a = agendamento({
      veterinario: { id: 'v1', subscriptionPlanCode: 'pro', user: { nome: 'X', sobrenome: null, celular: null, notificarWhatsapp: 0 } },
      clinica: { subscriptionPlanCode: 'clinic', whatsapp: '81977776666', nomeClinica: 'C' },
    })
    const r = await notificarAgendamento('novo_agendamento', a as never, ['profissional'])
    expect(r.profissional).toBe('ignorado')
    expect(enviarMock).not.toHaveBeenCalled()
    expect(prismaMock.whatsappEnvio.create.mock.calls[0][0].data).toMatchObject({ motivo: 'opt_out' })
  })

  it('falha do provedor é registrada e não lança erro', async () => {
    enviarMock.mockRejectedValue(new WhatsAppError('número inválido', false))
    const r = await notificarAgendamento('confirmacao', agendamento() as never, ['tutor'])
    expect(r.tutor).toBe('falhou')
    expect(prismaMock.whatsappEnvio.update.mock.calls[0][0].data).toMatchObject({ status: 'falhou', motivo: 'erro', erro: 'número inválido' })
  })

  it('erro de banco não propaga', async () => {
    prismaMock.agendamento.findUnique.mockRejectedValue(new Error('db down'))
    await expect(notificarAgendamento('confirmacao', 'ag-1', ['tutor'])).resolves.toEqual({})
  })

  it('envio já registrado (unique) não reenvia', async () => {
    prismaMock.whatsappEnvio.create.mockRejectedValue(duplicado())
    const r = await notificarAgendamento('lembrete_24h', agendamento() as never, ['tutor'])
    expect(r.tutor).toBe('duplicado')
    expect(enviarMock).not.toHaveBeenCalled()
  })

  it('evento que não se aplica ao destinatário é ignorado sem registro', async () => {
    const r = await notificarAgendamento('lembrete_24h', agendamento() as never, ['profissional'])
    expect(r.profissional).toBe('nao_aplicavel')
    expect(prismaMock.whatsappEnvio.create).not.toHaveBeenCalled()
  })

  it('remarcação muda a referência e libera novos lembretes', () => {
    expect(referenciaDaConsulta({ dataConsulta: '2026-10-10', horarioConsulta: '14:00' })).not.toBe(
      referenciaDaConsulta({ dataConsulta: '2026-10-11', horarioConsulta: '14:00' })
    )
  })
})

describe('lembreteDevido', () => {
  const inicio = inicioDaConsulta('2026-10-10', '14:00')
  const criadoCedo = new Date('2026-10-01T12:00:00Z')

  it('24h: entre 2h e 24h antes', () => {
    expect(lembreteDevido(inicio, inicio.minus({ hours: 23 }), criadoCedo)).toBe('lembrete_24h')
    expect(lembreteDevido(inicio, inicio.minus({ hours: 25 }), criadoCedo)).toBeNull()
  })

  it('2h: até 2h antes; depois do horário nada', () => {
    expect(lembreteDevido(inicio, inicio.minus({ minutes: 90 }), criadoCedo)).toBe('lembrete_2h')
    expect(lembreteDevido(inicio, inicio.plus({ minutes: 5 }), criadoCedo)).toBeNull()
  })

  it('consulta criada em cima da hora pula a janela correspondente', () => {
    const criada10hAntes = inicio.minus({ hours: 10 }).toJSDate()
    expect(lembreteDevido(inicio, inicio.minus({ hours: 5 }), criada10hAntes)).toBeNull()
    expect(lembreteDevido(inicio, inicio.minus({ hours: 1 }), criada10hAntes)).toBe('lembrete_2h')
    const criada1hAntes = inicio.minus({ hours: 1 }).toJSDate()
    expect(lembreteDevido(inicio, inicio.minus({ minutes: 30 }), criada1hAntes)).toBeNull()
  })
})

describe('processarLembretes', () => {
  it('envia o lembrete devido e conta duplicados na segunda execução', async () => {
    const agora = inicioDaConsulta('2026-10-10', '14:00').minus({ hours: 20 }) as DateTime<true>
    prismaMock.agendamento.findMany.mockResolvedValue([
      { id: 'ag-1', dataConsulta: '2026-10-10', horarioConsulta: '14:00', createdAt: new Date('2026-10-01T12:00:00Z') },
    ])
    prismaMock.agendamento.findUnique.mockResolvedValue(agendamento())

    const primeira = await processarLembretes(agora)
    expect(primeira).toMatchObject({ processadas: 1, enviadas: 1 })
    expect(prismaMock.whatsappEnvio.create.mock.calls[0][0].data).toMatchObject({ evento: 'lembrete_24h' })

    prismaMock.whatsappEnvio.create.mockRejectedValue(duplicado())
    const segunda = await processarLembretes(agora)
    expect(segunda).toMatchObject({ enviadas: 0, duplicadas: 1 })
    expect(enviarMock).toHaveBeenCalledTimes(1)
  })

  it('busca só consultas ativas entre hoje e depois de amanhã', async () => {
    prismaMock.agendamento.findMany.mockResolvedValue([])
    await processarLembretes(DateTime.fromISO('2026-10-09T10:00:00', { zone: 'America/Sao_Paulo' }) as DateTime<true>)
    const where = prismaMock.agendamento.findMany.mock.calls[0][0].where
    expect(where.dataConsulta.gte).toBe('2026-10-09')
    expect(where.dataConsulta.lte.startsWith('2026-10-11')).toBe(true)
    expect(where.status.in).not.toContain('cancelado')
  })
})

describe('cronAutorizado', () => {
  it('exige Bearer com o segredo; sem segredo configurado nega', () => {
    expect(cronAutorizado('Bearer s3cr3t', 's3cr3t')).toBe(true)
    expect(cronAutorizado('Bearer errado', 's3cr3t')).toBe(false)
    expect(cronAutorizado(null, 's3cr3t')).toBe(false)
    expect(cronAutorizado('Bearer s3cr3t', undefined)).toBe(false)
  })
})
