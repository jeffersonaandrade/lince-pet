import { describe, it, expect, vi, beforeEach } from 'vitest'
import { DateTime } from 'luxon'

const prismaMock = vi.hoisted(() => {
  const m: Record<string, any> = {
    tipoServico: { findFirst: vi.fn() },
    user: { findUnique: vi.fn(), findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
    prestador: { findFirst: vi.fn(), findMany: vi.fn(), findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
    pet: { findFirst: vi.fn(), findUnique: vi.fn() },
    tutor: { findUnique: vi.fn() },
    servicoOferecido: { findFirst: vi.fn(), findUnique: vi.fn() },
    bloqueioAgenda: { findMany: vi.fn() },
    agendamento: { findFirst: vi.fn(), findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
    subscriptionPlan: { findUnique: vi.fn() },
    whatsappEnvio: { create: vi.fn(), update: vi.fn() },
    agendamentoGoogleEvento: { findUnique: vi.fn(), upsert: vi.fn(), delete: vi.fn() },
  }
  m.$transaction = vi.fn((fn: (tx: unknown) => unknown) => fn(m))
  return m
})
vi.mock('@/server/db', () => ({ prisma: prismaMock }))

vi.mock('next/server', async (importOriginal) => ({
  ...(await importOriginal<typeof import('next/server')>()),
  after: vi.fn(),
}))

const axiosMock = vi.hoisted(() => ({ post: vi.fn(), patch: vi.fn(), delete: vi.fn() }))
vi.mock('axios', () => ({ default: axiosMock }))

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

import { HttpError } from '@/server/http'
import { buscarPrestadores, registrarPrestador } from '@/server/services/prestadores'
import {
  MENSAGEM_OCUPADO,
  aceitarPedido,
  bloqueioAtinge,
  calcularPeriodo,
  criarPedido,
  foraDaGrade,
  serializarPedido,
} from '@/server/services/pedidos-prestador'
import { notificarAgendamento } from '@/server/services/whatsapp-notificacoes'
import { googleCalendar } from '@/server/services/google-calendar'
import { profissionalDe } from '@/server/services/profissional'

const SP = 'America/Sao_Paulo'
const GRADE = Object.fromEntries(['0', '1', '2', '3', '4', '5', '6'].map((d) => [d, ['08:00', '20:00']]))
const codigoDe = (p: object) => (p as { start_code?: string | null }).start_code
const daqui = (dias: number) => DateTime.now().setZone(SP).plus({ days: dias }).toISODate()!

const TIPOS = [
  { slug: 'tosador', nome: 'Banho e tosa', modalidade: 'duracao' },
  { slug: 'passeador', nome: 'Passeador', modalidade: 'duracao' },
  { slug: 'adestrador', nome: 'Adestrador', modalidade: 'duracao' },
  { slug: 'pet_sitter', nome: 'Pet sitter', modalidade: 'periodo' },
] as const

const TUTOR = {
  id: 't1',
  user: { id: 'u-tutor', nome: 'Ana', sobrenome: 'Lima', celular: '81999990000', rua: 'Rua A', numero: '10', bairro: 'Centro', cidade: 'Recife', estado: 'PE' },
} as never

function prestador(tipo: (typeof TIPOS)[number]) {
  return {
    id: `pr-${tipo.slug}`,
    userId: 'u-prest',
    atendeDomicilio: 1,
    atendeLocalProprio: 1,
    horarios: GRADE,
    fotoUrl: null,
    subscriptionPlanCode: 'free',
    monthlyAppointmentsUsed: 0,
    monthlyAppointmentsResetAt: new Date(),
    tipoServico: { id: `ts-${tipo.slug}`, ...tipo },
    user: { id: 'u-prest', nome: 'Bia', sobrenome: 'Souza', celular: '81988887777', notificarWhatsapp: 1, rua: 'Rua B' },
  }
}

const servicoDe = (tipo: (typeof TIPOS)[number]) => ({
  id: `s-${tipo.slug}`,
  nome: `Serviço de ${tipo.nome}`,
  preco: 50,
  duracaoMin: tipo.modalidade === 'duracao' ? 60 : null,
})

beforeEach(() => {
  vi.clearAllMocks()
  prismaMock.$transaction.mockImplementation((fn: (tx: unknown) => unknown) => fn(prismaMock))
  prismaMock.pet.findFirst.mockResolvedValue({ id: 'p1', nome: 'Rex', especie: 'Cão', raca: null })
  prismaMock.bloqueioAgenda.findMany.mockResolvedValue([])
  prismaMock.agendamento.findFirst.mockResolvedValue(null)
  prismaMock.subscriptionPlan.findUnique.mockResolvedValue({ code: 'free', monthlyAppointmentLimit: 10, features: [] })
  prismaMock.prestador.update.mockResolvedValue({})
  prismaMock.agendamento.create.mockImplementation(({ data }: { data: Record<string, unknown> }) => ({
    ...data,
    id: 'ped-1',
    tutor: { user: TUTOR },
    pet: { id: 'p1', nome: 'Rex', especie: 'Cão', raca: null },
  }))
})

describe('regras puras do pedido', () => {
  it('duração: fim = início + duração do serviço', () => {
    const p = calcularPeriodo('duracao', { data: '2026-10-20', horario: '10:00' }, 90)
    expect(p.fim.diff(p.inicio, 'minutes').minutes).toBe(90)
  })

  it('período: conta diárias arredondando para cima e limita a 30', () => {
    expect(calcularPeriodo('periodo', { data: '2026-10-20', horario: '10:00', data_fim: '2026-10-23', horario_fim: '10:00' }, null).dias).toBe(3)
    expect(calcularPeriodo('periodo', { data: '2026-10-20', horario: '10:00', data_fim: '2026-10-23', horario_fim: '12:00' }, null).dias).toBe(4)
    expect(() => calcularPeriodo('periodo', { data: '2026-10-01', horario: '10:00', data_fim: '2026-11-15' }, null)).toThrow(/30/)
    expect(() => calcularPeriodo('periodo', { data: '2026-10-20', horario: '10:00' }, null)).toThrow(/saída/)
  })

  it('fora da grade semanal é recusado', () => {
    const grade = { '2': ['08:00', '12:00'] as [string, string] } // 2026-10-20 é terça
    const ok = calcularPeriodo('duracao', { data: '2026-10-20', horario: '10:00' }, 60)
    const tarde = calcularPeriodo('duracao', { data: '2026-10-20', horario: '11:30' }, 60)
    const quarta = calcularPeriodo('duracao', { data: '2026-10-21', horario: '10:00' }, 60)
    expect(foraDaGrade(grade, 'duracao', ok)).toBeNull()
    expect(foraDaGrade(grade, 'duracao', tarde)).toMatch(/Fora do horário/)
    expect(foraDaGrade(grade, 'duracao', quarta)).toMatch(/não atende/)
  })

  it('bloqueio de horário atinge 1h; dia inteiro atinge tudo', () => {
    const p = calcularPeriodo('duracao', { data: '2026-10-20', horario: '10:00' }, 60)
    expect(bloqueioAtinge([{ dataInicio: '2026-10-20', dataFim: '2026-10-20', horarios: ['10:30'] }], p)).toBe(true)
    expect(bloqueioAtinge([{ dataInicio: '2026-10-20', dataFim: '2026-10-20', horarios: ['14:00'] }], p)).toBe(false)
    expect(bloqueioAtinge([{ dataInicio: '2026-10-20', dataFim: '2026-10-20', horarios: null }], p)).toBe(true)
  })
})

describe('cadastro e busca', () => {
  it('cria usuário prestador com o tipo do catálogo, plano free e onboarding pendente', async () => {
    prismaMock.tipoServico.findFirst.mockResolvedValue({ id: 'ts-passeador', slug: 'passeador' })
    prismaMock.user.findFirst.mockResolvedValue(null)
    prismaMock.user.create.mockImplementation(({ data }: { data: object }) => ({ id: 'u-novo', ...data }))
    prismaMock.prestador.create.mockImplementation(({ data }: { data: object }) => ({ id: 'pr-novo', ...data }))

    const { user, prestador: p } = await registrarPrestador({
      tipo_servico: 'passeador', email: 'p@x.com', password: 'senha123', nome: 'Caio', sobrenome: 'Reis', celular: '81999998888',
    })
    expect(user).toMatchObject({ userType: 'prestador' })
    expect(p).toMatchObject({ tipoServicoId: 'ts-passeador', subscriptionPlanCode: 'free', onboardingComplete: 0 })
    expect(prismaMock.prestador.create.mock.calls[0][0].data).not.toHaveProperty('crmv')
  })

  it('tipo fora do catálogo é recusado', async () => {
    prismaMock.tipoServico.findFirst.mockResolvedValue(null)
    await expect(
      registrarPrestador({ tipo_servico: 'astronauta', email: 'a@x.com', password: 'senha123', nome: 'Caio', sobrenome: 'Reis', celular: '81999998888' })
    ).rejects.toThrow()
  })

  it('busca filtra por tipo e só mostra quem concluiu o onboarding', async () => {
    prismaMock.prestador.findMany.mockResolvedValue([])
    await buscarPrestadores({ tipo: 'adestrador' })
    const where = prismaMock.prestador.findMany.mock.calls[0][0].where
    expect(where).toMatchObject({ onboardingComplete: 1, user: { ativo: 1 }, tipoServico: { slug: 'adestrador' } })
  })
})

describe('critério de pronto: os 4 tipos recebem pedido sem virar veterinário', () => {
  it.each(TIPOS)('$nome recebe pedido pendente, sem veterinário', async (tipo) => {
    const p = prestador(tipo)
    prismaMock.prestador.findFirst.mockResolvedValue(p)
    prismaMock.servicoOferecido.findFirst.mockResolvedValue(servicoDe(tipo))
    prismaMock.agendamento.create.mockImplementation(({ data }: { data: Record<string, unknown> }) => ({
      ...data, id: 'ped-1', tutor: { user: TUTOR }, pet: null, prestador: p, servicoOferecido: servicoDe(tipo),
    }))

    const periodo = tipo.modalidade === 'periodo' ? { data_fim: daqui(10), horario_fim: '10:00' } : {}
    const pedido = await criarPedido(TUTOR, p.id, {
      pet_id: 'p1', servico_id: servicoDe(tipo).id, data: daqui(7), horario: '10:00', local: 'domicilio', ...periodo,
    })

    const data = prismaMock.agendamento.create.mock.calls[0][0].data
    expect(data).toMatchObject({ prestadorId: p.id, status: 'pendente', tipoConsulta: tipo.slug, servicoOferecidoId: servicoDe(tipo).id })
    expect(data.veterinarioId ?? null).toBeNull()
    expect(data.clinicaId ?? null).toBeNull()
    expect(pedido.tipo_servico).toMatchObject({ slug: tipo.slug })
    expect(codigoDe(pedido)).toBeNull()

    const minutos = (data.fimEm.getTime() - data.inicioEm.getTime()) / 60_000
    if (tipo.modalidade === 'duracao') {
      expect(minutos).toBe(60)
      expect(Number(data.precoConsulta)).toBe(50)
    } else {
      expect(minutos).toBe(3 * 24 * 60)
      expect(Number(data.precoConsulta)).toBe(150)
    }
    expect(prismaMock.prestador.update).toHaveBeenCalled()
    expect(profissionalDe({ prestador: p as never }).rotulo).toBe(tipo.nome)
  })
})

describe('agenda do prestador', () => {
  const tipo = TIPOS[0]
  beforeEach(() => {
    prismaMock.prestador.findFirst.mockResolvedValue(prestador(tipo))
    prismaMock.servicoOferecido.findFirst.mockResolvedValue(servicoDe(tipo))
  })
  const corpo = { pet_id: 'p1', servico_id: 's-tosador', data: daqui(7), horario: '10:00', local: 'domicilio' }

  it('sobreposição com outro pedido ativo retorna 409 e não grava', async () => {
    prismaMock.agendamento.findFirst.mockResolvedValue({ id: 'outro' })
    const erro = await criarPedido(TUTOR, 'pr-tosador', corpo).catch((e) => e)
    expect(erro).toBeInstanceOf(HttpError)
    expect(erro.status).toBe(409)
    expect(erro.message).toBe(MENSAGEM_OCUPADO)
    expect(prismaMock.agendamento.create).not.toHaveBeenCalled()
  })

  it('limite do plano atingido bloqueia o pedido (403)', async () => {
    prismaMock.prestador.findFirst.mockResolvedValue({ ...prestador(tipo), monthlyAppointmentsUsed: 10 })
    const erro = await criarPedido(TUTOR, 'pr-tosador', corpo).catch((e) => e)
    expect(erro.status).toBe(403)
  })

  it('local não atendido é recusado', async () => {
    prismaMock.prestador.findFirst.mockResolvedValue({ ...prestador(tipo), atendeDomicilio: 0 })
    await expect(criarPedido(TUTOR, 'pr-tosador', corpo)).rejects.toThrow(/domicílio/)
  })

  it('aceitar libera o código para o tutor', async () => {
    const base = {
      id: 'ped-1', status: 'pendente', inicioEm: DateTime.now().plus({ days: 2 }).toJSDate(), fimEm: null, startCode: '123456',
      prestador: prestador(tipo), tutor: { user: TUTOR }, pet: null, servicoOferecido: servicoDe(tipo),
    }
    prismaMock.agendamento.findFirst.mockResolvedValue(base)
    prismaMock.agendamento.update.mockResolvedValue({ ...base, status: 'confirmado' })
    const visaoPrestador = await aceitarPedido('pr-tosador', 'ped-1')
    expect(visaoPrestador.status).toBe('confirmado')
    expect(codigoDe(serializarPedido({ ...base, status: 'pendente' } as never, 'tutor'))).toBeNull()
    expect(codigoDe(serializarPedido({ ...base, status: 'confirmado' } as never, 'tutor'))).toBe('123456')
  })
})

describe('avisos do pedido', () => {
  const pedido = (planCode = 'pro') => ({
    id: 'ped-1',
    dataConsulta: '2026-10-20',
    horarioConsulta: '10:00',
    localNome: 'Domicílio do tutor',
    localEndereco: null,
    tipoConsulta: 'tosador',
    createdAt: new Date('2026-10-01T12:00:00Z'),
    tutor: { id: 't1', user: { nome: 'Ana', sobrenome: 'Lima', celular: '81999990000', notificarWhatsapp: 1 } },
    pet: { nome: 'Rex' },
    veterinario: null,
    clinica: null,
    prestador: { ...prestador(TIPOS[0]), subscriptionPlanCode: planCode },
    servicoOferecido: { nome: 'Banho completo' },
  })

  beforeEach(() => {
    prismaMock.subscriptionPlan.findUnique.mockImplementation(({ where }: { where: { code: string } }) => ({
      features: where.code === 'pro' ? ['whatsapp_notifications'] : [],
    }))
    prismaMock.whatsappEnvio.create.mockImplementation(({ data }: { data: object }) => ({ id: 'envio-1', ...data }))
    prismaMock.whatsappEnvio.update.mockResolvedValue({})
    enviarMock.mockResolvedValue({ id: 'msg-1' })
  })

  it('WhatsApp de novo pedido vai ao celular do prestador, com texto de serviço', async () => {
    const r = await notificarAgendamento('novo_agendamento', pedido() as never, ['profissional'])
    expect(r.profissional).toBe('enviado')
    const [to, texto] = enviarMock.mock.calls[0]
    expect(to).toBe('5581988887777')
    expect(texto).toContain('Banho completo')
    expect(texto).not.toMatch(/consulta|Dr\(a\)/i)
  })

  it('WhatsApp depende do plano do prestador', async () => {
    const r = await notificarAgendamento('novo_agendamento', pedido('free') as never, ['profissional'])
    expect(r.profissional).toBe('ignorado')
    expect(enviarMock).not.toHaveBeenCalled()
  })

  it('Google Agenda cria o evento do serviço na agenda do prestador', async () => {
    const inicio = DateTime.fromISO('2026-10-20T10:00', { zone: SP })
    prismaMock.agendamento.findUnique.mockResolvedValue({
      id: 'ped-1', tutorId: 't1', veterinarioId: null, prestadorId: 'pr-tosador', servicoOferecidoId: 's1', petId: 'p1',
      inicioEm: inicio.toJSDate(), fimEm: inicio.plus({ hours: 1 }).toJSDate(), precoConsulta: 50, startCode: '123456',
      localNome: 'Domicílio do tutor', localEndereco: null,
    })
    prismaMock.tutor.findUnique.mockResolvedValue({ id: 't1', userId: 'u-tutor' })
    prismaMock.pet.findUnique.mockResolvedValue({ id: 'p1', nome: 'Rex' })
    prismaMock.prestador.findUnique.mockResolvedValue({ id: 'pr-tosador', userId: 'u-prest', tipoServico: { nome: 'Banho e tosa' } })
    prismaMock.servicoOferecido.findUnique.mockResolvedValue({ id: 's1', nome: 'Banho completo' })
    prismaMock.user.findUnique.mockImplementation(({ where }: { where: { id: string } }) =>
      where.id === 'u-prest'
        ? { id: 'u-prest', nome: 'Bia', googleCalendarAuthorized: 1, googleAccessToken: 'tok-prest', googleTokenExpiresAt: new Date(Date.now() + 3_600_000) }
        : { id: where.id, nome: 'Ana', googleCalendarAuthorized: 0 }
    )
    prismaMock.agendamentoGoogleEvento.findUnique.mockResolvedValue(null)
    axiosMock.post.mockResolvedValue({ data: { id: 'evt-1' } })

    await googleCalendar.sincronizarEvento('ped-1', 'criar')
    expect(axiosMock.post).toHaveBeenCalledTimes(1)
    const [, body, cfg] = axiosMock.post.mock.calls[0]
    expect(cfg.headers.Authorization).toBe('Bearer tok-prest')
    expect(body.summary).toContain('Banho completo')
    expect(body.summary).not.toMatch(/consulta/i)
    expect(body.end.dateTime).toContain('2026-10-20T11:00')
  })
})
