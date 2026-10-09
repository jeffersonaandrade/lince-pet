import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { DateTime } from 'luxon'

const prismaMock = vi.hoisted(() => {
  const m: Record<string, any> = {
    prestador: { findFirst: vi.fn() },
    pet: { findFirst: vi.fn() },
    servicoOferecido: { findFirst: vi.fn() },
    bloqueioAgenda: { findMany: vi.fn() },
    agendamento: { findFirst: vi.fn(), findMany: vi.fn(), findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
  }
  m.$transaction = vi.fn()
  return m
})
vi.mock('@/server/db', () => ({ prisma: prismaMock }))

const afterMock = vi.hoisted(() => vi.fn())
vi.mock('next/server', async (importOriginal) => ({
  ...(await importOriginal<typeof import('next/server')>()),
  after: afterMock,
}))

const sub = vi.hoisted(() => ({ canCreateAppointment: vi.fn(), incrementUsage: vi.fn(), decrementUsage: vi.fn() }))
vi.mock('@/server/services/subscription', () => sub)

const enc = vi.hoisted(() => ({ conferirEncaminhamento: vi.fn(), vincularAgendamento: vi.fn() }))
vi.mock('@/server/services/encaminhamentos', () => enc)

vi.mock('@/server/services/in-app-notifications', () => ({ inAppNotifications: { createGenericNotification: vi.fn() } }))
vi.mock('@/server/services/notifications', () => ({ notifications: { sendPedidoServico: vi.fn() } }))
vi.mock('@/server/services/canais-notificacao', () => ({ podeEnviarEmail: vi.fn(() => false) }))
vi.mock('@/server/services/whatsapp-notificacoes', () => ({ notificarAgendamento: vi.fn() }))
vi.mock('@/server/services/google-calendar', () => ({ googleCalendar: { sincronizarEvento: vi.fn() } }))

import { HttpError } from '@/server/http'
import {
  MAX_DIAS_HOSPEDAGEM,
  MENSAGEM_BLOQUEADO,
  MENSAGEM_OCUPADO,
  STATUS_OCUPAM,
  bloqueioAtinge,
  bloqueiosDoPrestador,
  calcularPeriodo,
  criarPedido,
  disponibilidade,
  foraDaGrade,
  remarcarPedido,
  sobrepoe,
} from '@/server/services/pedidos-prestador'

const SP = 'America/Sao_Paulo'
// Sexta, 09/10/2026 09:00 em São Paulo.
const AGORA = new Date('2026-10-09T12:00:00Z')
const GRADE = Object.fromEntries(['0', '1', '2', '3', '4', '5', '6'].map((d) => [d, ['08:00', '20:00']]))

const prestadorBase = (over: Record<string, unknown> = {}) => ({
  id: 'pr-1',
  userId: 'u-prest',
  atendeDomicilio: 1,
  atendeLocalProprio: 1,
  horarios: GRADE,
  fotoUrl: null,
  monthlyAppointmentsUsed: 0,
  tipoServico: { id: 'ts-1', slug: 'tosador', nome: 'Banho e tosa', modalidade: 'duracao' },
  user: { id: 'u-prest', nome: 'Bia', sobrenome: 'Souza', rua: 'Rua B', numero: null, bairro: null, cidade: 'Olinda', estado: 'PE' },
  ...over,
})
const hospedagem = (over: Record<string, unknown> = {}) =>
  prestadorBase({ tipoServico: { id: 'ts-2', slug: 'pet_sitter', nome: 'Pet sitter', modalidade: 'periodo' }, ...over })

const TUTOR = {
  id: 't1',
  user: { id: 'u-tutor', nome: 'Ana', sobrenome: 'Lima', rua: 'Rua A', numero: '10', bairro: 'Centro', cidade: 'Recife', estado: 'PE' },
} as never

const servico = (over: Record<string, unknown> = {}) => ({ id: 's1', nome: 'Banho', preco: 50, duracaoMin: 60, ...over })
const corpo = (over: Record<string, unknown> = {}) => ({
  pet_id: 'p1',
  servico_id: 's1',
  data: '2026-10-20',
  horario: '10:00',
  local: 'domicilio',
  ...over,
})

const erroDe = (p: Promise<unknown>) => p.then(() => null, (e) => e as HttpError)

beforeEach(() => {
  vi.clearAllMocks()
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(AGORA)
  prismaMock.$transaction.mockImplementation((fn: (tx: unknown) => unknown) => fn(prismaMock))
  prismaMock.prestador.findFirst.mockResolvedValue(prestadorBase())
  prismaMock.pet.findFirst.mockResolvedValue({ id: 'p1', nome: 'Rex' })
  prismaMock.servicoOferecido.findFirst.mockResolvedValue(servico())
  prismaMock.bloqueioAgenda.findMany.mockResolvedValue([])
  prismaMock.agendamento.findFirst.mockResolvedValue(null)
  prismaMock.agendamento.findMany.mockResolvedValue([])
  prismaMock.agendamento.create.mockImplementation(({ data }: { data: Record<string, unknown> }) => ({
    ...data,
    id: 'ped-1',
    tutor: { user: { nome: 'Ana', sobrenome: 'Lima', celular: '81999990000' } },
    pet: null,
    prestador: prestadorBase(),
    servicoOferecido: servico(),
  }))
  prismaMock.agendamento.update.mockImplementation(({ data }: { data: Record<string, unknown> }) => ({
    id: 'ped-1',
    tutor: null,
    pet: null,
    prestador: null,
    servicoOferecido: null,
    precoConsulta: null,
    ...data,
  }))
  sub.canCreateAppointment.mockResolvedValue({ allowed: true })
})

afterEach(() => {
  vi.useRealTimers()
})

/* ------------------------------- regras puras ------------------------------ */

describe('calcularPeriodo', () => {
  it('rejeita data inexistente com 400', () => {
    let e: HttpError | null = null
    try {
      calcularPeriodo('duracao', { data: '2026-02-30', horario: '10:00' }, 60)
    } catch (err) {
      e = err as HttpError
    }
    expect(e).toBeInstanceOf(HttpError)
    expect(e!.status).toBe(400)
    expect(e!.message).toBe('Data ou horário inválido')
  })

  it('modalidade duração exige duração do serviço', () => {
    expect(() => calcularPeriodo('duracao', { data: '2026-10-20', horario: '10:00' }, null)).toThrow('Serviço sem duração definida')
    expect(() => calcularPeriodo('duracao', { data: '2026-10-20', horario: '10:00' }, 0)).toThrow('Serviço sem duração definida')
  })

  it('duração: dias = 1 e fim = início + minutos, no fuso de São Paulo', () => {
    const p = calcularPeriodo('duracao', { data: '2026-10-20', horario: '10:00' }, 45)
    expect(p.dias).toBe(1)
    expect(p.inicio.zoneName).toBe(SP)
    expect(p.inicio.toISO()).toBe('2026-10-20T10:00:00.000-03:00')
    expect(p.fim.toISO()).toBe('2026-10-20T10:45:00.000-03:00')
  })

  it('período: saída inválida, saída antes da entrada e saída igual à entrada são recusadas', () => {
    expect(() =>
      calcularPeriodo('periodo', { data: '2026-10-20', horario: '10:00', data_fim: '2026-02-30' }, null)
    ).toThrow('Data ou horário de saída inválido')
    expect(() =>
      calcularPeriodo('periodo', { data: '2026-10-20', horario: '10:00', data_fim: '2026-10-19' }, null)
    ).toThrow('A saída deve ser depois da entrada')
    expect(() =>
      calcularPeriodo('periodo', { data: '2026-10-20', horario: '10:00', data_fim: '2026-10-20', horario_fim: '10:00' }, null)
    ).toThrow('A saída deve ser depois da entrada')
  })

  it('período: sem horário de saída usa o horário de entrada; frações de dia viram 1 diária', () => {
    const p = calcularPeriodo('periodo', { data: '2026-10-20', horario: '10:00', data_fim: '2026-10-22', horario_fim: null }, null)
    expect(p.fim.toISO()).toBe('2026-10-22T10:00:00.000-03:00')
    expect(p.dias).toBe(2)
    const curta = calcularPeriodo('periodo', { data: '2026-10-20', horario: '10:00', data_fim: '2026-10-20', horario_fim: '18:00' }, null)
    expect(curta.dias).toBe(1)
  })

  it(`período: aceita exatamente ${MAX_DIAS_HOSPEDAGEM} diárias e recusa ${MAX_DIAS_HOSPEDAGEM + 1}`, () => {
    expect(calcularPeriodo('periodo', { data: '2026-10-01', horario: '10:00', data_fim: '2026-10-31' }, null).dias).toBe(30)
    expect(() => calcularPeriodo('periodo', { data: '2026-10-01', horario: '10:00', data_fim: '2026-11-01' }, null)).toThrow(
      'A hospedagem pode ter no máximo 30 diárias'
    )
  })
})

describe('foraDaGrade', () => {
  const grade = { '2': ['08:00', '12:00'], '4': ['09:00', '17:00'] } as Record<string, [string, string]>
  const p = (ini: string, fim: string) => ({ inicio: DateTime.fromISO(ini, { zone: SP }), fim: DateTime.fromISO(fim, { zone: SP }) })

  it('duração: serviço que atravessa a meia-noite está fora do horário', () => {
    expect(foraDaGrade({ '2': ['00:00', '23:59'] }, 'duracao', p('2026-10-20T23:30', '2026-10-21T00:30'))).toBe(
      'Fora do horário de atendimento (00:00 às 23:59)'
    )
  })

  it('duração: início antes da abertura é recusado e fim exatamente no fechamento é aceito', () => {
    expect(foraDaGrade(grade, 'duracao', p('2026-10-20T07:30', '2026-10-20T08:30'))).toMatch(/Fora do horário/)
    expect(foraDaGrade(grade, 'duracao', p('2026-10-20T11:00', '2026-10-20T12:00'))).toBeNull()
  })

  it('período: valida entrada e saída nas grades dos respectivos dias', () => {
    expect(foraDaGrade(grade, 'periodo', p('2026-10-20T10:00', '2026-10-22T10:00'))).toBeNull()
    expect(foraDaGrade(grade, 'periodo', p('2026-10-21T10:00', '2026-10-22T10:00'))).toBe('O profissional não atende no dia da entrada')
    expect(foraDaGrade(grade, 'periodo', p('2026-10-20T10:00', '2026-10-23T10:00'))).toBe('O profissional não atende no dia da saída')
    expect(foraDaGrade(grade, 'periodo', p('2026-10-20T13:00', '2026-10-22T10:00'))).toBe(
      'Horário de entrada fora do atendimento (08:00 às 12:00)'
    )
    expect(foraDaGrade(grade, 'periodo', p('2026-10-20T10:00', '2026-10-22T08:00'))).toBe(
      'Horário de saída fora do atendimento (09:00 às 17:00)'
    )
  })
})

describe('sobrepoe', () => {
  const d = (h: number) => new Date(Date.UTC(2026, 9, 20, h))
  it('períodos encostados não se sobrepõem; interseção sobrepõe', () => {
    expect(sobrepoe({ inicio: d(10), fim: d(11) }, { inicio: d(11), fim: d(12) })).toBe(false)
    expect(sobrepoe({ inicio: d(10), fim: d(12) }, { inicio: d(11), fim: d(13) })).toBe(true)
    expect(sobrepoe({ inicio: d(10), fim: d(13) }, { inicio: d(11), fim: d(12) })).toBe(true)
  })
})

describe('bloqueioAtinge', () => {
  const periodo = (ini: string, fim: string) => ({
    inicio: DateTime.fromISO(ini, { zone: SP }),
    fim: DateTime.fromISO(fim, { zone: SP }),
  })

  it('ignora bloqueio fora das datas do período', () => {
    expect(bloqueioAtinge([{ dataInicio: '2026-10-25', dataFim: '2026-10-26', horarios: null }], periodo('2026-10-20T10:00', '2026-10-20T11:00'))).toBe(false)
  })

  it('hospedagem de vários dias é atingida por bloqueio de dia inteiro no meio do período', () => {
    expect(bloqueioAtinge([{ dataInicio: '2026-10-22', dataFim: '2026-10-22', horarios: null }], periodo('2026-10-20T10:00', '2026-10-24T10:00'))).toBe(true)
  })

  it('bloqueio recorrente só atinge os dias da semana configurados', () => {
    const recorrente = { dataInicio: '2026-10-01', dataFim: null, horarios: null, recorrente: 1, diasSemana: [3] }
    expect(bloqueioAtinge([recorrente], periodo('2026-10-20T10:00', '2026-10-20T11:00'))).toBe(false) // terça
    expect(bloqueioAtinge([recorrente], periodo('2026-10-21T10:00', '2026-10-21T11:00'))).toBe(true) // quarta
  })

  it('horário bloqueado cobre exatamente 1h: encostado não atinge', () => {
    const b = [{ dataInicio: '2026-10-20', dataFim: '2026-10-20', horarios: ['09:00'] }]
    expect(bloqueioAtinge(b, periodo('2026-10-20T10:00', '2026-10-20T11:00'))).toBe(false)
    expect(bloqueioAtinge(b, periodo('2026-10-20T09:59', '2026-10-20T10:30'))).toBe(true)
  })
})

describe('bloqueiosDoPrestador', () => {
  it('busca bloqueios que podem cobrir o intervalo, com fim padrão = início', async () => {
    await bloqueiosDoPrestador('pr-1', '2026-10-20')
    expect(prismaMock.bloqueioAgenda.findMany).toHaveBeenCalledWith({
      where: { prestadorId: 'pr-1', dataInicio: { lte: '2026-10-20' }, OR: [{ dataFim: null }, { dataFim: { gte: '2026-10-20' } }] },
      orderBy: [{ dataInicio: 'asc' }, { createdAt: 'asc' }],
    })
    await bloqueiosDoPrestador('pr-1', '2026-10-20', '2026-10-25')
    expect(prismaMock.bloqueioAgenda.findMany.mock.calls[1][0].where.dataInicio).toEqual({ lte: '2026-10-25' })
  })
})

/* ---------------------------------- criação -------------------------------- */

describe('criarPedido', () => {
  it('pedido nasce pendente, com código de 6 dígitos, cota consumida e aviso de novo pedido agendado', async () => {
    const pedido = await criarPedido(TUTOR, 'pr-1', corpo({ observacoes: '  Cão bravo  ' }))

    expect(prismaMock.prestador.findFirst).toHaveBeenCalledWith({
      where: { id: 'pr-1', onboardingComplete: 1, user: { ativo: 1 }, tipoServico: { ativo: 1 } },
      include: { user: true, tipoServico: true },
    })
    expect(prismaMock.pet.findFirst).toHaveBeenCalledWith({ where: { id: 'p1', tutorId: 't1' } })
    expect(prismaMock.servicoOferecido.findFirst).toHaveBeenCalledWith({ where: { id: 's1', prestadorId: 'pr-1', ativo: 1 } })

    const data = prismaMock.agendamento.create.mock.calls[0][0].data
    expect(data).toMatchObject({
      tutorId: 't1',
      petId: 'p1',
      prestadorId: 'pr-1',
      servicoOferecidoId: 's1',
      status: 'pendente',
      tipoConsulta: 'tosador',
      precoConsulta: 50,
      observacoes: 'Cão bravo',
      localNome: 'Domicílio do tutor',
      localEndereco: 'Rua A, 10 - Centro - Recife - PE',
      startCodeAttempts: 0,
      dataConsulta: '2026-10-20',
      horarioConsulta: '10:00',
    })
    expect(data.startCode).toMatch(/^\d{6}$/)
    expect(data.inicioEm.toISOString()).toBe('2026-10-20T13:00:00.000Z')
    expect(data.fimEm.toISOString()).toBe('2026-10-20T14:00:00.000Z')
    expect(data.startCodeExpiresAt.toISOString()).toBe('2026-10-21T02:59:59.000Z')
    expect(data.id).toBeTruthy()

    expect(sub.canCreateAppointment).toHaveBeenCalledWith(expect.objectContaining({ id: 'pr-1' }), 'prestador')
    expect(sub.incrementUsage).toHaveBeenCalledWith(expect.objectContaining({ id: 'pr-1' }), 'prestador')
    expect(enc.conferirEncaminhamento).not.toHaveBeenCalled()
    expect(enc.vincularAgendamento).not.toHaveBeenCalled()
    expect(afterMock).toHaveBeenCalledTimes(1)
    expect(pedido).toMatchObject({ id: 'ped-1', status: 'pendente', start_code: null, preco: 50 })
  })

  it('o callback do after dispara o aviso "novo" do pedido', async () => {
    await criarPedido(TUTOR, 'pr-1', corpo())
    prismaMock.agendamento.findUnique.mockResolvedValueOnce(null)
    await afterMock.mock.calls[0][0]()
    expect(prismaMock.agendamento.findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'ped-1' } }))
  })

  it('local próprio usa o endereço do profissional; sem observação grava null', async () => {
    await criarPedido(TUTOR, 'pr-1', corpo({ local: 'local_proprio' }))
    const data = prismaMock.agendamento.create.mock.calls[0][0].data
    expect(data.localNome).toBe('Local do profissional')
    expect(data.localEndereco).toBe('Rua B - Olinda - PE')
    expect(data.observacoes).toBeNull()
  })

  it('domicílio sem dados do usuário do tutor grava endereço null', async () => {
    await criarPedido({ id: 't1', user: null } as never, 'pr-1', corpo())
    expect(prismaMock.agendamento.create.mock.calls[0][0].data.localEndereco).toBeNull()
  })

  it('endereço vazio do profissional vira null', async () => {
    prismaMock.prestador.findFirst.mockResolvedValueOnce(
      prestadorBase({ user: { id: 'u', rua: null, numero: null, bairro: null, cidade: null, estado: null } })
    )
    await criarPedido(TUTOR, 'pr-1', corpo({ local: 'local_proprio' }))
    expect(prismaMock.agendamento.create.mock.calls[0][0].data.localEndereco).toBeNull()
  })

  it('hospedagem: preço = diária × dias', async () => {
    prismaMock.prestador.findFirst.mockResolvedValueOnce(hospedagem())
    prismaMock.servicoOferecido.findFirst.mockResolvedValueOnce(servico({ preco: '33.33', duracaoMin: null }))
    await criarPedido(TUTOR, 'pr-1', corpo({ data_fim: '2026-10-23', horario_fim: '10:00' }))
    const data = prismaMock.agendamento.create.mock.calls[0][0].data
    expect(data.precoConsulta).toBe(99.99)
    expect(data.tipoConsulta).toBe('pet_sitter')
  })

  it('corpo inválido é rejeitado pelo validador antes de consultar o banco', async () => {
    const e = await erroDe(criarPedido(TUTOR, 'pr-1', corpo({ horario: '25:00', local: 'praia' })))
    expect(e).toBeTruthy()
    expect((e as unknown as { status: number }).status).toBe(422)
    expect(prismaMock.prestador.findFirst).not.toHaveBeenCalled()
  })

  it.each([
    ['profissional', () => prismaMock.prestador.findFirst.mockResolvedValueOnce(null), 'Profissional não encontrado'],
    ['pet', () => prismaMock.pet.findFirst.mockResolvedValueOnce(null), 'Pet não encontrado'],
    ['serviço', () => prismaMock.servicoOferecido.findFirst.mockResolvedValueOnce(null), 'Serviço não encontrado'],
  ])('%s inexistente responde 404', async (_n, preparar, mensagem) => {
    preparar()
    const e = await erroDe(criarPedido(TUTOR, 'pr-1', corpo()))
    expect(e).toBeInstanceOf(HttpError)
    expect(e!.status).toBe(404)
    expect(e!.message).toBe(mensagem)
    expect(prismaMock.agendamento.create).not.toHaveBeenCalled()
  })

  it('local que o profissional não atende é recusado com 400', async () => {
    prismaMock.prestador.findFirst.mockResolvedValueOnce(prestadorBase({ atendeLocalProprio: 0 }))
    const e = await erroDe(criarPedido(TUTOR, 'pr-1', corpo({ local: 'local_proprio' })))
    expect(e!.status).toBe(400)
    expect(e!.message).toBe('Este profissional não atende em local próprio')

    prismaMock.prestador.findFirst.mockResolvedValueOnce(prestadorBase({ atendeDomicilio: 0 }))
    const e2 = await erroDe(criarPedido(TUTOR, 'pr-1', corpo()))
    expect(e2!.message).toBe('Este profissional não atende em domicílio')
  })

  it('horário no passado é recusado', async () => {
    const e = await erroDe(criarPedido(TUTOR, 'pr-1', corpo({ data: '2026-10-09', horario: '08:30' })))
    expect(e!.status).toBe(400)
    expect(e!.message).toBe('Escolha um horário futuro')
  })

  it('fora da grade semanal é recusado; prestador sem grade não atende', async () => {
    prismaMock.prestador.findFirst.mockResolvedValueOnce(prestadorBase({ horarios: { '2': ['08:00', '10:30'] } }))
    const e = await erroDe(criarPedido(TUTOR, 'pr-1', corpo()))
    expect(e!.message).toBe('Fora do horário de atendimento (08:00 às 10:30)')

    prismaMock.prestador.findFirst.mockResolvedValueOnce(prestadorBase({ horarios: null }))
    const e2 = await erroDe(criarPedido(TUTOR, 'pr-1', corpo()))
    expect(e2!.message).toBe('O profissional não atende neste dia da semana')
  })

  it('bloqueio no período recusa o pedido com a mensagem de agenda bloqueada', async () => {
    prismaMock.bloqueioAgenda.findMany.mockResolvedValueOnce([{ dataInicio: '2026-10-20', dataFim: '2026-10-20', horarios: ['10:00'] }])
    const e = await erroDe(criarPedido(TUTOR, 'pr-1', corpo()))
    expect(e!.status).toBe(400)
    expect(e!.message).toBe(MENSAGEM_BLOQUEADO)
  })

  it('sobreposição com pedido ativo responde 409 antes da transação', async () => {
    prismaMock.agendamento.findFirst.mockResolvedValueOnce({ id: 'outro' })
    const e = await erroDe(criarPedido(TUTOR, 'pr-1', corpo()))
    expect(e!.status).toBe(409)
    expect(e!.message).toBe(MENSAGEM_OCUPADO)
    const where = prismaMock.agendamento.findFirst.mock.calls[0][0].where
    expect(where).toEqual({
      prestadorId: 'pr-1',
      status: { in: STATUS_OCUPAM },
      inicioEm: { lt: new Date('2026-10-20T14:00:00Z') },
      fimEm: { gt: new Date('2026-10-20T13:00:00Z') },
    })
    expect(prismaMock.$transaction).not.toHaveBeenCalled()
  })

  it('checagem de sobreposição é refeita dentro da transação (corrida) e responde 409', async () => {
    prismaMock.agendamento.findFirst.mockResolvedValueOnce(null).mockResolvedValueOnce({ id: 'corrida' })
    const e = await erroDe(criarPedido(TUTOR, 'pr-1', corpo()))
    expect(e!.status).toBe(409)
    expect(prismaMock.agendamento.create).not.toHaveBeenCalled()
    expect(sub.incrementUsage).not.toHaveBeenCalled()
  })

  it('limite do plano free atingido responde 403 sem gravar', async () => {
    sub.canCreateAppointment.mockResolvedValueOnce({ allowed: false, limit: 10, used: 10 })
    const e = await erroDe(criarPedido(TUTOR, 'pr-1', corpo()))
    expect(e!.status).toBe(403)
    expect(e!.message).toMatch(/limite de pedidos do mês/)
    expect(prismaMock.agendamento.create).not.toHaveBeenCalled()
  })

  it('com encaminhamento: confere o vínculo antes e vincula o pedido depois', async () => {
    await criarPedido(TUTOR, 'pr-1', corpo({ encaminhamento_id: 'enc-1' }))
    expect(enc.conferirEncaminhamento).toHaveBeenCalledWith('enc-1', { tutorId: 't1', petId: 'p1', prestadorId: 'pr-1' })
    expect(enc.vincularAgendamento).toHaveBeenCalledWith('enc-1', 'ped-1')
  })

  it('encaminhamento inválido interrompe a criação', async () => {
    enc.conferirEncaminhamento.mockRejectedValueOnce(new HttpError(409, { message: 'Já marcado' }))
    const e = await erroDe(criarPedido(TUTOR, 'pr-1', corpo({ encaminhamento_id: 'enc-1' })))
    expect(e!.status).toBe(409)
    expect(prismaMock.agendamento.create).not.toHaveBeenCalled()
  })
})

/* ------------------------------ disponibilidade ---------------------------- */

describe('disponibilidade', () => {
  it.each([
    ['profissional', () => prismaMock.prestador.findFirst.mockResolvedValueOnce(null), 'Profissional não encontrado', 404],
    ['serviço', () => prismaMock.servicoOferecido.findFirst.mockResolvedValueOnce(null), 'Serviço não encontrado', 404],
  ])('%s inexistente responde 404', async (_n, preparar, mensagem, status) => {
    preparar()
    const e = await erroDe(disponibilidade('pr-1', 's1', '2026-10-20'))
    expect(e!.status).toBe(status)
    expect(e!.message).toBe(mensagem)
  })

  it('data em formato inválido responde 400', async () => {
    const e = await erroDe(disponibilidade('pr-1', 's1', '20/10/2026'))
    expect(e!.status).toBe(400)
    expect(e!.message).toBe('Data inválida')
  })

  it('dia sem atendimento retorna lista vazia sem consultar agenda', async () => {
    prismaMock.prestador.findFirst.mockResolvedValueOnce(prestadorBase({ horarios: { '1': ['08:00', '12:00'] } }))
    const r = await disponibilidade('pr-1', 's1', '2026-10-20')
    expect(r).toEqual({ data: '2026-10-20', modalidade: 'duracao', faixa: null, horarios: [] })
    expect(prismaMock.agendamento.findMany).not.toHaveBeenCalled()
  })

  it('slots de 30 em 30 min que cabem a duração, sem sobrepor pedidos ativos', async () => {
    prismaMock.prestador.findFirst.mockResolvedValueOnce(prestadorBase({ horarios: { '2': ['08:00', '10:00'] } }))
    prismaMock.agendamento.findMany.mockResolvedValueOnce([
      { inicioEm: new Date('2026-10-20T12:00:00Z'), fimEm: new Date('2026-10-20T12:30:00Z') }, // 09:00-09:30
      { inicioEm: null, fimEm: null },
    ])
    const r = await disponibilidade('pr-1', 's1', '2026-10-20')
    expect(r.faixa).toEqual(['08:00', '10:00'])
    expect(r.horarios).toEqual(['08:00'])
    expect(prismaMock.agendamento.findMany).toHaveBeenCalledWith({
      where: {
        prestadorId: 'pr-1',
        status: { in: STATUS_OCUPAM },
        inicioEm: { lt: new Date('2026-10-20T13:00:00Z') },
        fimEm: { gt: new Date('2026-10-20T11:00:00Z') },
      },
      select: { inicioEm: true, fimEm: true },
    })
  })

  it('remove slots bloqueados e slots que já passaram hoje', async () => {
    prismaMock.prestador.findFirst.mockResolvedValueOnce(prestadorBase({ horarios: { '5': ['08:00', '11:00'] } }))
    prismaMock.bloqueioAgenda.findMany.mockResolvedValueOnce([{ dataInicio: '2026-10-09', dataFim: '2026-10-09', horarios: ['10:00'] }])
    const r = await disponibilidade('pr-1', 's1', '2026-10-09')
    // agora = 09:00; 09:00 não é futuro; 09:30 e 10:00 caem no bloqueio das 10h
    expect(r.horarios).toEqual([])
  })

  it('hospedagem e serviço sem duração usam passos de 30 min', async () => {
    prismaMock.prestador.findFirst.mockResolvedValueOnce(hospedagem({ horarios: { '2': ['08:00', '09:00'] } }))
    const r = await disponibilidade('pr-1', 's1', '2026-10-20')
    expect(r).toMatchObject({ modalidade: 'periodo', horarios: ['08:00', '08:30'] })

    prismaMock.prestador.findFirst.mockResolvedValueOnce(prestadorBase({ horarios: { '2': ['08:00', '09:00'] } }))
    prismaMock.servicoOferecido.findFirst.mockResolvedValueOnce(servico({ duracaoMin: null }))
    const r2 = await disponibilidade('pr-1', 's1', '2026-10-20')
    expect(r2.horarios).toEqual(['08:00', '08:30'])
  })
})

/* --------------------------------- remarcar -------------------------------- */

describe('remarcarPedido', () => {
  const pedido = (over: Record<string, unknown> = {}) => ({
    id: 'ped-1',
    status: 'confirmado',
    prestadorId: 'pr-1',
    inicioEm: new Date('2026-10-20T13:00:00Z'),
    fimEm: new Date('2026-10-20T14:30:00Z'),
    servicoOferecido: servico({ duracaoMin: 90, preco: 80 }),
    ...over,
  })

  it('volta para pendente (precisa de novo aceite), zera tentativas e recalcula o preço', async () => {
    prismaMock.agendamento.findFirst.mockResolvedValueOnce(pedido()).mockResolvedValueOnce(null)
    const r = await remarcarPedido('t1', 'ped-1', { data: '2026-10-21', horario: '09:00' })

    expect(prismaMock.agendamento.findFirst.mock.calls[0][0].where).toEqual({ id: 'ped-1', tutorId: 't1', prestadorId: { not: null } })
    // a checagem de sobreposição ignora o próprio pedido
    expect(prismaMock.agendamento.findFirst.mock.calls[1][0].where.id).toEqual({ not: 'ped-1' })
    const { data } = prismaMock.agendamento.update.mock.calls[0][0]
    expect(data).toMatchObject({
      status: 'pendente',
      confirmadoEm: null,
      startCodeAttempts: 0,
      precoConsulta: 80,
      dataConsulta: '2026-10-21',
      horarioConsulta: '09:00',
    })
    expect(data.fimEm.getTime() - data.inicioEm.getTime()).toBe(90 * 60_000)
    expect(r.status).toBe('pendente')
    expect(afterMock).toHaveBeenCalledTimes(1)
    await afterMock.mock.calls[0][0]()
    expect(prismaMock.agendamento.findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'ped-1' } }))
  })

  it('sem serviço vinculado usa a duração original e não mexe no preço', async () => {
    prismaMock.agendamento.findFirst.mockResolvedValueOnce(pedido({ servicoOferecido: null })).mockResolvedValueOnce(null)
    await remarcarPedido('t1', 'ped-1', { data: '2026-10-21', horario: '09:00' })
    const { data } = prismaMock.agendamento.update.mock.calls[0][0]
    expect(data.fimEm.getTime() - data.inicioEm.getTime()).toBe(90 * 60_000)
    expect(data).not.toHaveProperty('precoConsulta')
  })

  it('sem serviço nem período original não há duração: 400', async () => {
    prismaMock.agendamento.findFirst.mockResolvedValueOnce(pedido({ servicoOferecido: null, inicioEm: null, fimEm: null }))
    const e = await erroDe(remarcarPedido('t1', 'ped-1', { data: '2026-10-21', horario: '09:00' }))
    expect(e!.message).toBe('Serviço sem duração definida')
    expect(prismaMock.agendamento.update).not.toHaveBeenCalled()
  })

  it('hospedagem remarcada recalcula diárias', async () => {
    prismaMock.prestador.findFirst.mockResolvedValueOnce(hospedagem())
    prismaMock.agendamento.findFirst
      .mockResolvedValueOnce(pedido({ servicoOferecido: servico({ duracaoMin: null, preco: 40 }) }))
      .mockResolvedValueOnce(null)
    await remarcarPedido('t1', 'ped-1', { data: '2026-10-21', horario: '09:00', data_fim: '2026-10-25' })
    expect(prismaMock.agendamento.update.mock.calls[0][0].data.precoConsulta).toBe(160)
  })

  it('pedido inexistente responde 404 e pedido já realizado não pode ser alterado', async () => {
    prismaMock.agendamento.findFirst.mockResolvedValueOnce(null)
    const e = await erroDe(remarcarPedido('t1', 'x', { data: '2026-10-21', horario: '09:00' }))
    expect(e!.status).toBe(404)
    expect(e!.message).toBe('Agendamento não encontrado')

    prismaMock.agendamento.findFirst.mockResolvedValueOnce(pedido({ status: 'realizado' }))
    const e2 = await erroDe(remarcarPedido('t1', 'ped-1', { data: '2026-10-21', horario: '09:00' }))
    expect(e2!.status).toBe(400)
    expect(e2!.message).toBe('Este pedido não pode mais ser alterado')
  })

  it('profissional desativado responde 404', async () => {
    prismaMock.agendamento.findFirst.mockResolvedValueOnce(pedido())
    prismaMock.prestador.findFirst.mockResolvedValueOnce(null)
    const e = await erroDe(remarcarPedido('t1', 'ped-1', { data: '2026-10-21', horario: '09:00' }))
    expect(e!.status).toBe(404)
    expect(e!.message).toBe('Profissional não encontrado')
  })

  it('novo horário ocupado responde 409', async () => {
    prismaMock.agendamento.findFirst.mockResolvedValueOnce(pedido()).mockResolvedValueOnce({ id: 'outro' })
    const e = await erroDe(remarcarPedido('t1', 'ped-1', { data: '2026-10-21', horario: '09:00' }))
    expect(e!.status).toBe(409)
    expect(prismaMock.agendamento.update).not.toHaveBeenCalled()
  })
})
