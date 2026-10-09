import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const prismaMock = vi.hoisted(() => ({
  bloqueioAgenda: { findMany: vi.fn(), findFirst: vi.fn(), create: vi.fn(), delete: vi.fn() },
  agendamento: { findFirst: vi.fn(), findMany: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
}))
vi.mock('@/server/db', () => ({ prisma: prismaMock }))

const afterMock = vi.hoisted(() => vi.fn())
vi.mock('next/server', async (importOriginal) => ({
  ...(await importOriginal<typeof import('next/server')>()),
  after: afterMock,
}))

const sub = vi.hoisted(() => ({ canCreateAppointment: vi.fn(), incrementUsage: vi.fn(), decrementUsage: vi.fn() }))
vi.mock('@/server/services/subscription', () => sub)
vi.mock('@/server/services/encaminhamentos', () => ({ conferirEncaminhamento: vi.fn(), vincularAgendamento: vi.fn() }))

const avisos = vi.hoisted(() => ({
  createGenericNotification: vi.fn(),
  sendPedidoServico: vi.fn(),
  podeEnviarEmail: vi.fn(),
  notificarAgendamento: vi.fn(),
  sincronizarEvento: vi.fn(),
}))
vi.mock('@/server/services/in-app-notifications', () => ({
  inAppNotifications: { createGenericNotification: avisos.createGenericNotification },
}))
vi.mock('@/server/services/notifications', () => ({ notifications: { sendPedidoServico: avisos.sendPedidoServico } }))
vi.mock('@/server/services/canais-notificacao', () => ({ podeEnviarEmail: avisos.podeEnviarEmail }))
vi.mock('@/server/services/whatsapp-notificacoes', () => ({ notificarAgendamento: avisos.notificarAgendamento }))
vi.mock('@/server/services/google-calendar', () => ({ googleCalendar: { sincronizarEvento: avisos.sincronizarEvento } }))

import { HttpError } from '@/server/http'
import {
  MOTIVO_RECUSA,
  STATUS_OCUPAM,
  aceitarPedido,
  avisarPedido,
  cancelarPedidoPeloTutor,
  concluirPedido,
  criarBloqueioPrestador,
  descreverPeriodo,
  ehPedidoDePrestador,
  iniciarPedido,
  listarBloqueiosPrestador,
  listarPedidosDoPrestador,
  listarPedidosDoTutor,
  recusarPedido,
  removerBloqueioPrestador,
  serializarPedido,
  type EventoPedido,
} from '@/server/services/pedidos-prestador'

const AGORA = new Date('2026-10-09T12:00:00Z')

const PREST_USER = { id: 'u-prest', nome: 'Bia', sobrenome: 'Souza', email: 'bia@x.com', celular: '81988887777', profilePic: 'perfil.png' }
const TUTOR_USER = { id: 'u-tutor', nome: 'Ana', sobrenome: 'Lima', email: 'ana@x.com', celular: '81999990000' }
const PRESTADOR = {
  id: 'pr-1',
  fotoUrl: null,
  monthlyAppointmentsUsed: 3,
  tipoServico: { slug: 'tosador', nome: 'Banho e tosa', modalidade: 'duracao' },
  user: PREST_USER,
}

const pedido = (over: Record<string, unknown> = {}) => ({
  id: 'ped-1',
  status: 'pendente',
  inicioEm: new Date('2026-10-20T13:00:00Z'),
  fimEm: new Date('2026-10-20T14:00:00Z'),
  dataConsulta: '2026-10-20',
  horarioConsulta: '10:00',
  precoConsulta: '50',
  observacoes: null,
  localNome: 'Domicílio do tutor',
  localEndereco: 'Rua A, 10',
  motivoCancelamento: null,
  startedAt: null,
  endedAt: null,
  startCode: '123456',
  startCodeAttempts: 0,
  startCodeExpiresAt: new Date('2026-10-21T02:59:59Z'),
  tutor: { user: TUTOR_USER },
  pet: { id: 'p1', nome: 'Rex', especie: 'Cão', raca: 'SRD' },
  prestador: PRESTADOR,
  servicoOferecido: { id: 's1', nome: 'Banho completo', duracaoMin: 60 },
  ...over,
})

const erroDe = (p: Promise<unknown>) => p.then(() => null, (e) => e as HttpError)
const rodarAfter = async () => {
  for (const [cb] of afterMock.mock.calls) await cb()
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(AGORA)
  prismaMock.agendamento.update.mockImplementation(({ data }: { data: Record<string, unknown> }) => ({ ...pedido(), ...data }))
  prismaMock.agendamento.findMany.mockResolvedValue([])
  prismaMock.agendamento.findUnique.mockResolvedValue(null)
  avisos.podeEnviarEmail.mockReturnValue(true)
})

afterEach(() => {
  vi.useRealTimers()
})

/* ------------------------------ serialização ------------------------------- */

describe('serializarPedido', () => {
  it('visão do tutor: código só depois do aceite e celular do profissional só com pedido ativo', () => {
    const pendente = serializarPedido(pedido() as never, 'tutor')
    expect(pendente).toMatchObject({
      id: 'ped-1',
      status: 'pendente',
      inicio_em: '2026-10-20T13:00:00.000Z',
      fim_em: '2026-10-20T14:00:00.000Z',
      preco: 50,
      start_code: null,
      servico: { id: 's1', nome: 'Banho completo', duracao_min: 60 },
      tipo_servico: { slug: 'tosador', nome: 'Banho e tosa', modalidade: 'duracao' },
      pet: { id: 'p1', nome: 'Rex', especie: 'Cão', raca: 'SRD' },
      prestador: { id: 'pr-1', nome: 'Bia Souza', foto_url: 'perfil.png', celular: null },
    })
    expect(pendente).not.toHaveProperty('tutor')

    const confirmado = serializarPedido(pedido({ status: 'confirmado' }) as never, 'tutor')
    expect(confirmado).toMatchObject({ start_code: '123456', prestador: { celular: '81988887777' } })

    const emAndamento = serializarPedido(pedido({ status: 'em andamento' }) as never, 'tutor')
    expect(emAndamento).toMatchObject({ start_code: null, prestador: { celular: '81988887777' } })
  })

  it('visão do tutor sem usuário do profissional usa rótulo genérico e foto do prestador', () => {
    const r = serializarPedido(
      pedido({ status: 'confirmado', prestador: { ...PRESTADOR, fotoUrl: 'foto.png', user: null } }) as never,
      'tutor'
    )
    expect(r).toMatchObject({ prestador: { nome: 'Profissional', foto_url: 'foto.png', celular: null } })
  })

  it('visão do tutor sem foto nenhuma devolve null', () => {
    const r = serializarPedido(pedido({ prestador: { ...PRESTADOR, user: { ...PREST_USER, profilePic: null } } }) as never, 'tutor')
    expect((r as { prestador: { foto_url: unknown } }).prestador.foto_url).toBeNull()
  })

  it('visão do prestador: nunca mostra o código; celular do tutor só com pedido ativo', () => {
    const pend = serializarPedido(pedido() as never, 'prestador')
    expect(pend).not.toHaveProperty('start_code')
    expect(pend).toMatchObject({ tutor: { nome: 'Ana Lima', celular: null } })
    const conf = serializarPedido(pedido({ status: 'confirmado' }) as never, 'prestador')
    expect(conf).toMatchObject({ tutor: { celular: '81999990000' } })
  })

  it('campos ausentes viram null', () => {
    const vazio = pedido({
      inicioEm: null,
      fimEm: null,
      precoConsulta: null,
      startedAt: new Date('2026-10-20T13:05:00Z'),
      endedAt: new Date('2026-10-20T14:05:00Z'),
      servicoOferecido: null,
      prestador: null,
      pet: null,
      tutor: null,
    })
    expect(serializarPedido(vazio as never, 'prestador')).toMatchObject({
      inicio_em: null,
      fim_em: null,
      preco: null,
      started_at: '2026-10-20T13:05:00.000Z',
      ended_at: '2026-10-20T14:05:00.000Z',
      servico: null,
      tipo_servico: null,
      pet: null,
      tutor: null,
    })
    expect(serializarPedido(vazio as never, 'tutor')).toMatchObject({ prestador: null })
  })
})

/* ------------------------------ lado prestador ----------------------------- */

describe('listarPedidosDoPrestador', () => {
  it('filtra por status quando informado e ordena por início', async () => {
    prismaMock.agendamento.findMany.mockResolvedValueOnce([pedido()])
    const r = await listarPedidosDoPrestador('pr-1', 'pendente')
    expect(prismaMock.agendamento.findMany.mock.calls[0][0]).toMatchObject({
      where: { prestadorId: 'pr-1', status: 'pendente' },
      orderBy: [{ inicioEm: 'asc' }],
    })
    expect(r).toHaveLength(1)
    expect(r[0]).toHaveProperty('tutor')

    await listarPedidosDoPrestador('pr-1')
    expect(prismaMock.agendamento.findMany.mock.calls[1][0].where).toEqual({ prestadorId: 'pr-1' })
  })
})

describe('aceitarPedido', () => {
  it('pedido de outro prestador (ou inexistente) responde 404', async () => {
    prismaMock.agendamento.findFirst.mockResolvedValueOnce(null)
    const e = await erroDe(aceitarPedido('pr-1', 'ped-x'))
    expect(e!.status).toBe(404)
    expect(e!.message).toBe('Pedido não encontrado')
    expect(prismaMock.agendamento.findFirst.mock.calls[0][0].where).toEqual({ id: 'ped-x', prestadorId: 'pr-1' })
  })

  it('só pendente pode ser aceito', async () => {
    prismaMock.agendamento.findFirst.mockResolvedValueOnce(pedido({ status: 'confirmado' }))
    const e = await erroDe(aceitarPedido('pr-1', 'ped-1'))
    expect(e!.status).toBe(400)
    expect(e!.message).toBe('Só pedidos pendentes podem ser aceitos')
  })

  it('pedido cujo horário já passou não pode ser aceito', async () => {
    prismaMock.agendamento.findFirst.mockResolvedValueOnce(pedido({ inicioEm: new Date('2026-10-09T11:00:00Z') }))
    const e = await erroDe(aceitarPedido('pr-1', 'ped-1'))
    expect(e!.message).toBe('O horário deste pedido já passou')
    expect(prismaMock.agendamento.update).not.toHaveBeenCalled()
  })

  it('aceite confirma o pedido, registra a data e agenda o aviso "aceito"', async () => {
    prismaMock.agendamento.findFirst.mockResolvedValueOnce(pedido({ inicioEm: null }))
    const r = await aceitarPedido('pr-1', 'ped-1')
    const args = prismaMock.agendamento.update.mock.calls[0][0]
    expect(args.where).toEqual({ id: 'ped-1' })
    expect(args.data.status).toBe('confirmado')
    expect(typeof args.data.confirmadoEm).toBe('string')
    expect(args.data.updatedAt).toBeDefined()
    expect(r.status).toBe('confirmado')

    prismaMock.agendamento.findUnique.mockResolvedValueOnce(pedido({ status: 'confirmado' }))
    await rodarAfter()
    expect(avisos.createGenericNotification).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'u-tutor', type: 'PEDIDO_ACEITO' })
    )
  })
})

describe('recusarPedido', () => {
  it('recusa pendente com motivo, devolve a cota e avisa o tutor com o motivo', async () => {
    prismaMock.agendamento.findFirst.mockResolvedValueOnce(pedido())
    const r = await recusarPedido('pr-1', 'ped-1', '  agenda cheia  ')
    const { data } = prismaMock.agendamento.update.mock.calls[0][0]
    expect(data.status).toBe('cancelado')
    expect(data.motivoCancelamento).toBe(`${MOTIVO_RECUSA}: agenda cheia`)
    expect(typeof data.canceladoEm).toBe('string')
    expect(sub.decrementUsage).toHaveBeenCalledWith(PRESTADOR, 'prestador')
    expect(r.status).toBe('cancelado')

    prismaMock.agendamento.findUnique.mockResolvedValueOnce(pedido({ status: 'cancelado' }))
    await rodarAfter()
    expect(avisos.notificarAgendamento).toHaveBeenCalledWith('cancelamento', 'ped-1', ['tutor'], {
      motivo: `${MOTIVO_RECUSA}: agenda cheia`,
    })
  })

  it('confirmado também pode ser recusado; motivo em branco usa o padrão', async () => {
    prismaMock.agendamento.findFirst.mockResolvedValueOnce(pedido({ status: 'confirmado' }))
    await recusarPedido('pr-1', 'ped-1', '   ')
    expect(prismaMock.agendamento.update.mock.calls[0][0].data.motivoCancelamento).toBe(MOTIVO_RECUSA)
  })

  it('motivo longo é cortado em 255 caracteres e sem prestador não mexe na cota', async () => {
    prismaMock.agendamento.findFirst.mockResolvedValueOnce(pedido({ prestador: null }))
    await recusarPedido('pr-1', 'ped-1', 'x'.repeat(400))
    expect(prismaMock.agendamento.update.mock.calls[0][0].data.motivoCancelamento).toHaveLength(255)
    expect(sub.decrementUsage).not.toHaveBeenCalled()
  })

  it.each(['em andamento', 'realizado', 'cancelado'])('pedido %s não pode mais ser recusado', async (status) => {
    prismaMock.agendamento.findFirst.mockResolvedValueOnce(pedido({ status }))
    const e = await erroDe(recusarPedido('pr-1', 'ped-1'))
    expect(e!.status).toBe(400)
    expect(e!.message).toBe('Este pedido não pode mais ser recusado')
  })
})

describe('iniciarPedido (código de início)', () => {
  it.each([undefined, '', 123456])('código ausente ou não-texto (%s) é obrigatório', async (code) => {
    prismaMock.agendamento.findFirst.mockResolvedValueOnce(pedido({ status: 'confirmado' }))
    const e = await erroDe(iniciarPedido('pr-1', 'ped-1', code))
    expect(e!.message).toBe('Código é obrigatório')
  })

  it('só pedido aceito (confirmado) pode ser iniciado', async () => {
    prismaMock.agendamento.findFirst.mockResolvedValueOnce(pedido({ status: 'pendente' }))
    const e = await erroDe(iniciarPedido('pr-1', 'ped-1', '123456'))
    expect(e!.message).toBe('Só pedidos aceitos podem ser iniciados')
  })

  it('após 5 tentativas inválidas bloqueia, mesmo com o código certo', async () => {
    prismaMock.agendamento.findFirst.mockResolvedValueOnce(pedido({ status: 'confirmado', startCodeAttempts: 5 }))
    const e = await erroDe(iniciarPedido('pr-1', 'ped-1', '123456'))
    expect(e!.message).toBe('Muitas tentativas inválidas. Peça ao tutor para remarcar o pedido.')
    expect(prismaMock.agendamento.update).not.toHaveBeenCalled()
  })

  it('pedido sem código ativo ou sem validade é recusado', async () => {
    prismaMock.agendamento.findFirst.mockResolvedValueOnce(pedido({ status: 'confirmado', startCode: null }))
    expect((await erroDe(iniciarPedido('pr-1', 'ped-1', '123456')))!.message).toBe('Este pedido não possui código ativo')
    prismaMock.agendamento.findFirst.mockResolvedValueOnce(pedido({ status: 'confirmado', startCodeExpiresAt: null }))
    expect((await erroDe(iniciarPedido('pr-1', 'ped-1', '123456')))!.message).toBe('Este pedido não possui código ativo')
  })

  it('código expirado é recusado', async () => {
    prismaMock.agendamento.findFirst.mockResolvedValueOnce(
      pedido({ status: 'confirmado', startCodeExpiresAt: new Date('2026-10-09T11:59:59Z') })
    )
    const e = await erroDe(iniciarPedido('pr-1', 'ped-1', '123456'))
    expect(e!.message).toBe('Código expirado')
  })

  it('código errado incrementa as tentativas e responde 400', async () => {
    prismaMock.agendamento.findFirst.mockResolvedValueOnce(pedido({ status: 'confirmado', startCodeAttempts: 4 }))
    const e = await erroDe(iniciarPedido('pr-1', 'ped-1', '000000'))
    expect(e!.status).toBe(400)
    expect(e!.message).toBe('Código inválido')
    const args = prismaMock.agendamento.update.mock.calls[0][0]
    expect(args.where).toEqual({ id: 'ped-1' })
    expect(args.data.startCodeAttempts).toBe(5)
  })

  it('tentativas nulas contam como zero', async () => {
    prismaMock.agendamento.findFirst.mockResolvedValueOnce(pedido({ status: 'confirmado', startCodeAttempts: null }))
    await erroDe(iniciarPedido('pr-1', 'ped-1', '000000'))
    expect(prismaMock.agendamento.update.mock.calls[0][0].data.startCodeAttempts).toBe(1)
  })

  it('código certo inicia o serviço (em andamento) marcando uso e início', async () => {
    prismaMock.agendamento.findFirst.mockResolvedValueOnce(pedido({ status: 'confirmado' }))
    const r = await iniciarPedido('pr-1', 'ped-1', '123456')
    const { data } = prismaMock.agendamento.update.mock.calls[0][0]
    expect(data).toMatchObject({ status: 'em andamento', startCodeUsedAt: AGORA, startedAt: AGORA })
    expect(r.status).toBe('em andamento')
    expect(afterMock).not.toHaveBeenCalled()
  })
})

describe('concluirPedido', () => {
  it('exige serviço iniciado com o código', async () => {
    prismaMock.agendamento.findFirst.mockResolvedValueOnce(pedido({ status: 'confirmado' }))
    const e = await erroDe(concluirPedido('pr-1', 'ped-1'))
    expect(e!.message).toBe('Inicie o serviço com o código do tutor antes de concluir')
  })

  it('conclui (realizado) com data de término e agenda aviso "concluido"', async () => {
    prismaMock.agendamento.findFirst.mockResolvedValueOnce(pedido({ status: 'em andamento' }))
    const r = await concluirPedido('pr-1', 'ped-1')
    expect(prismaMock.agendamento.update.mock.calls[0][0].data).toMatchObject({ status: 'realizado', endedAt: AGORA })
    expect(r.status).toBe('realizado')
    expect(afterMock).toHaveBeenCalledTimes(1)

    prismaMock.agendamento.findUnique.mockResolvedValueOnce(pedido({ status: 'realizado' }))
    await rodarAfter()
    expect(avisos.createGenericNotification).toHaveBeenCalledWith(expect.objectContaining({ type: 'PEDIDO_CONCLUIDO' }))
  })
})

/* -------------------------------- lado tutor ------------------------------- */

describe('lado tutor', () => {
  it('lista só pedidos de prestador do tutor, mais recentes primeiro, na visão do tutor', async () => {
    prismaMock.agendamento.findMany.mockResolvedValueOnce([pedido({ status: 'confirmado' })])
    const r = await listarPedidosDoTutor('t1')
    expect(prismaMock.agendamento.findMany.mock.calls[0][0]).toMatchObject({
      where: { tutorId: 't1', prestadorId: { not: null } },
      orderBy: [{ inicioEm: 'desc' }],
    })
    expect(r[0]).toMatchObject({ start_code: '123456' })
  })

  it('ehPedidoDePrestador identifica agendamento de prestador', async () => {
    prismaMock.agendamento.findFirst
      .mockResolvedValueOnce({ prestadorId: 'pr-1' })
      .mockResolvedValueOnce({ prestadorId: null })
      .mockResolvedValueOnce(null)
    expect(await ehPedidoDePrestador('a1', 't1')).toBe(true)
    expect(await ehPedidoDePrestador('a2', 't1')).toBe(false)
    expect(await ehPedidoDePrestador('a3', 't1')).toBe(false)
    expect(prismaMock.agendamento.findFirst.mock.calls[0][0]).toEqual({
      where: { id: 'a1', tutorId: 't1' },
      select: { prestadorId: true },
    })
  })

  it('cancelar pelo tutor grava motivo padrão, devolve a cota e avisa o profissional', async () => {
    prismaMock.agendamento.findFirst.mockResolvedValueOnce(pedido({ status: 'confirmado' }))
    await cancelarPedidoPeloTutor('t1', 'ped-1')
    const { data } = prismaMock.agendamento.update.mock.calls[0][0]
    expect(data).toMatchObject({ status: 'cancelado', motivoCancelamento: 'Cancelado pelo tutor' })
    expect(sub.decrementUsage).toHaveBeenCalledWith(PRESTADOR, 'prestador')

    prismaMock.agendamento.findUnique.mockResolvedValueOnce(pedido({ status: 'cancelado' }))
    await rodarAfter()
    expect(avisos.notificarAgendamento).toHaveBeenCalledWith('cancelamento', 'ped-1', ['profissional'], { motivo: null })
  })

  it('cancelar com motivo usa o texto informado (até 255) e sem prestador não devolve cota', async () => {
    prismaMock.agendamento.findFirst.mockResolvedValueOnce(pedido({ prestador: null }))
    await cancelarPedidoPeloTutor('t1', 'ped-1', 'y'.repeat(300))
    expect(prismaMock.agendamento.update.mock.calls[0][0].data.motivoCancelamento).toBe('y'.repeat(255))
    expect(sub.decrementUsage).not.toHaveBeenCalled()
  })

  it('pedido em andamento não pode ser cancelado pelo tutor', async () => {
    prismaMock.agendamento.findFirst.mockResolvedValueOnce(pedido({ status: 'em andamento' }))
    const e = await erroDe(cancelarPedidoPeloTutor('t1', 'ped-1'))
    expect(e!.message).toBe('Este pedido não pode mais ser alterado')
    expect(prismaMock.agendamento.update).not.toHaveBeenCalled()
  })
})

/* -------------------------------- bloqueios -------------------------------- */

describe('bloqueios do prestador', () => {
  const bloqueioSalvo = (over: Record<string, unknown> = {}) => ({
    id: 'b1',
    veterinarioId: null,
    prestadorId: 'pr-1',
    dataInicio: '2026-10-20',
    dataFim: '2026-10-20',
    recorrente: 0,
    diasSemana: null,
    horarios: ['10:00'],
    motivo: 'Consulta médica',
    clinicaId: null,
    createdAt: AGORA,
    ...over,
  })

  it('bloqueio que atinge pedido ativo é recusado com 409 e a lista de conflitos', async () => {
    prismaMock.agendamento.findMany.mockResolvedValueOnce([
      pedido({ id: 'ped-conflito' }), // 10:00-11:00
      pedido({ id: 'ped-livre', inicioEm: new Date('2026-10-20T17:00:00Z'), fimEm: new Date('2026-10-20T18:00:00Z') }),
      pedido({ id: 'ped-sem-horario', inicioEm: null }),
    ])
    const e = await erroDe(criarBloqueioPrestador('pr-1', 'u-prest', { data_inicio: '2026-10-20', horarios: ['10:00'] }))
    expect(e).toBeInstanceOf(HttpError)
    expect(e!.status).toBe(409)
    const body = e!.body as { conflitos: { id: string }[]; message: string }
    expect(body.message).toMatch(/Há pedidos ativos neste período/)
    expect(body.conflitos.map((c) => c.id)).toEqual(['ped-conflito'])
    expect(prismaMock.agendamento.findMany.mock.calls[0][0].where).toEqual({
      prestadorId: 'pr-1',
      status: { in: STATUS_OCUPAM },
      fimEm: { gt: new Date('2026-10-20T03:00:00Z') },
      inicioEm: { lt: new Date('2026-10-21T03:00:00Z') },
    })
    expect(prismaMock.bloqueioAgenda.create).not.toHaveBeenCalled()
  })

  it('sem conflito cria o bloqueio registrando quem bloqueou', async () => {
    prismaMock.bloqueioAgenda.create.mockImplementationOnce(({ data }: { data: Record<string, unknown> }) => bloqueioSalvo(data))
    const r = await criarBloqueioPrestador('pr-1', 'u-prest', {
      data_inicio: '2026-10-20',
      horarios: ['10:00'],
      motivo: 'Consulta médica',
    })
    const { data } = prismaMock.bloqueioAgenda.create.mock.calls[0][0]
    expect(data).toMatchObject({
      prestadorId: 'pr-1',
      dataInicio: '2026-10-20',
      dataFim: '2026-10-20',
      recorrente: 0,
      horarios: ['10:00'],
      motivo: 'Consulta médica',
      criadoPorUserId: 'u-prest',
    })
    expect(data.diasSemana).toBeUndefined()
    expect(r).toMatchObject({ data_inicio: '2026-10-20', dia_inteiro: false, horarios: ['10:00'] })
  })

  it('bloqueio recorrente sem data final não limita o início na busca de conflitos', async () => {
    prismaMock.bloqueioAgenda.create.mockImplementationOnce(({ data }: { data: Record<string, unknown> }) => bloqueioSalvo(data))
    await criarBloqueioPrestador('pr-1', 'u-prest', { data_inicio: '2026-10-20', recorrente: true, dias_semana: [2] })
    const where = prismaMock.agendamento.findMany.mock.calls[0][0].where
    expect(where).not.toHaveProperty('inicioEm')
    const { data } = prismaMock.bloqueioAgenda.create.mock.calls[0][0]
    expect(data).toMatchObject({ recorrente: 1, dataFim: null, diasSemana: [2] })
    expect(data.horarios).toBeUndefined()
  })

  it('lista bloqueios vigentes a partir de hoje', async () => {
    prismaMock.bloqueioAgenda.findMany.mockResolvedValueOnce([bloqueioSalvo({ horarios: null })])
    const r = await listarBloqueiosPrestador('pr-1')
    expect(prismaMock.bloqueioAgenda.findMany).toHaveBeenCalledWith({
      where: { prestadorId: 'pr-1', OR: [{ dataFim: null }, { dataFim: { gte: '2026-10-09' } }] },
      orderBy: [{ dataInicio: 'asc' }],
    })
    expect(r).toEqual([expect.objectContaining({ id: 'b1', dia_inteiro: true })])
  })

  it('remover bloqueio de outro prestador responde 404; o próprio é apagado', async () => {
    prismaMock.bloqueioAgenda.findFirst.mockResolvedValueOnce(null)
    const e = await erroDe(removerBloqueioPrestador('pr-1', 'b9'))
    expect(e!.status).toBe(404)
    expect(prismaMock.bloqueioAgenda.delete).not.toHaveBeenCalled()

    prismaMock.bloqueioAgenda.findFirst.mockResolvedValueOnce(bloqueioSalvo())
    await removerBloqueioPrestador('pr-1', 'b1')
    expect(prismaMock.bloqueioAgenda.findFirst).toHaveBeenLastCalledWith({ where: { id: 'b1', prestadorId: 'pr-1' } })
    expect(prismaMock.bloqueioAgenda.delete).toHaveBeenCalledWith({ where: { id: 'b1' } })
  })
})

/* ---------------------------------- avisos --------------------------------- */

describe('descreverPeriodo', () => {
  it('formata no fuso de São Paulo, mesmo dia ou vários dias', () => {
    expect(descreverPeriodo({ inicioEm: null, fimEm: null })).toBe('')
    expect(descreverPeriodo({ inicioEm: new Date('2026-10-20T13:00:00Z'), fimEm: new Date('2026-10-20T14:30:00Z') })).toBe(
      '20/10/2026 das 10:00 às 11:30'
    )
    expect(descreverPeriodo({ inicioEm: new Date('2026-10-20T13:00:00Z'), fimEm: null })).toBe('20/10/2026 das 10:00 às 10:00')
    expect(descreverPeriodo({ inicioEm: new Date('2026-10-20T13:00:00Z'), fimEm: new Date('2026-10-23T13:00:00Z') })).toBe(
      '20/10/2026 10:00 até 23/10/2026 10:00'
    )
  })
})

describe('avisarPedido', () => {
  const quando = '20/10/2026 das 10:00 às 11:00'
  const detalhes = [
    ['Serviço', 'Banho completo'],
    ['Pet', 'Rex'],
    ['Quando', quando],
    ['Local', 'Domicílio do tutor - Rua A, 10'],
    ['Valor', 'R$ 50.00'],
  ]

  it('não faz nada se o pedido não existe ou não é de prestador', async () => {
    prismaMock.agendamento.findUnique.mockResolvedValueOnce(null).mockResolvedValueOnce(pedido({ prestador: null }))
    await avisarPedido('novo', 'ped-x')
    await avisarPedido('novo', 'ped-1')
    expect(avisos.createGenericNotification).not.toHaveBeenCalled()
    expect(avisos.notificarAgendamento).not.toHaveBeenCalled()
  })

  it('novo: avisa profissional e tutor (sino e e-mail) e WhatsApp do profissional; sem agenda', async () => {
    prismaMock.agendamento.findUnique.mockResolvedValueOnce(pedido())
    await avisarPedido('novo', 'ped-1')

    expect(avisos.createGenericNotification).toHaveBeenNthCalledWith(1, {
      userId: 'u-prest',
      type: 'PEDIDO_NOVO',
      title: 'Novo pedido de serviço',
      message: `Ana Lima pediu "Banho completo" para Rex (${quando}). Aceite ou recuse no seu painel.`,
      actionData: { agendamentoId: 'ped-1', pedido: true },
    })
    expect(avisos.createGenericNotification).toHaveBeenNthCalledWith(2, expect.objectContaining({ userId: 'u-tutor', title: 'Pedido enviado' }))
    expect(avisos.sendPedidoServico).toHaveBeenNthCalledWith(1, 'bia@x.com', 'Novo pedido de serviço', {
      titulo: 'Novo pedido de serviço',
      saudacao: 'Olá, Bia!',
      paragrafos: [expect.stringContaining('Ana Lima pediu')],
      detalhes,
    })
    expect(avisos.notificarAgendamento).toHaveBeenCalledWith('novo_agendamento', 'ped-1', ['profissional'], { motivo: null })
    expect(avisos.sincronizarEvento).not.toHaveBeenCalled()
    const textos = avisos.createGenericNotification.mock.calls.map(([n]) => `${n.title} ${n.message}`).join(' ')
    expect(textos).not.toMatch(/consulta|Dr\(a\)/i)
  })

  it('aceito: só o tutor recebe, com o código de início; cria evento na agenda', async () => {
    prismaMock.agendamento.findUnique.mockResolvedValueOnce(pedido({ status: 'confirmado' }))
    await avisarPedido('aceito', 'ped-1')
    expect(avisos.createGenericNotification).toHaveBeenCalledTimes(1)
    expect(avisos.createGenericNotification.mock.calls[0][0]).toMatchObject({
      userId: 'u-tutor',
      type: 'PEDIDO_ACEITO',
      message: expect.stringContaining('Código de início: 123456.'),
    })
    expect(avisos.notificarAgendamento).toHaveBeenCalledWith('confirmacao', 'ped-1', ['tutor'], { motivo: null })
    expect(avisos.sincronizarEvento).toHaveBeenCalledWith('ped-1', 'criar')
  })

  it('recusado: inclui o motivo; sem motivo a mensagem não fica com espaço sobrando', async () => {
    prismaMock.agendamento.findUnique.mockResolvedValueOnce(pedido()).mockResolvedValueOnce(pedido())
    await avisarPedido('recusado', 'ped-1', 'Sem vaga')
    await avisarPedido('recusado', 'ped-1')
    const [comMotivo, semMotivo] = avisos.createGenericNotification.mock.calls.map(([n]) => n.message)
    expect(comMotivo).toBe(`Bia Souza não poderá atender "Banho completo" para Rex (${quando}). Motivo: Sem vaga`)
    expect(semMotivo).toBe(`Bia Souza não poderá atender "Banho completo" para Rex (${quando}).`)
    expect(avisos.sincronizarEvento).toHaveBeenCalledWith('ped-1', 'cancelar')
  })

  it('cancelado: avisa profissional e tutor e cancela o evento da agenda', async () => {
    prismaMock.agendamento.findUnique.mockResolvedValueOnce(pedido())
    await avisarPedido('cancelado', 'ped-1', 'Viagem')
    const tipos = avisos.createGenericNotification.mock.calls.map(([n]) => [n.userId, n.type])
    expect(tipos).toEqual([
      ['u-prest', 'PEDIDO_CANCELADO'],
      ['u-tutor', 'PEDIDO_CANCELADO'],
    ])
    expect(avisos.createGenericNotification.mock.calls[0][0].message).toContain('Motivo: Viagem')
    expect(avisos.notificarAgendamento).toHaveBeenCalledWith('cancelamento', 'ped-1', ['profissional'], { motivo: 'Viagem' })
    expect(avisos.sincronizarEvento).toHaveBeenCalledWith('ped-1', 'cancelar')
  })

  it('remarcado: só o profissional, pedindo novo aceite; atualiza a agenda', async () => {
    prismaMock.agendamento.findUnique.mockResolvedValueOnce(pedido())
    await avisarPedido('remarcado', 'ped-1')
    expect(avisos.createGenericNotification).toHaveBeenCalledTimes(1)
    expect(avisos.createGenericNotification.mock.calls[0][0]).toMatchObject({
      userId: 'u-prest',
      message: expect.stringContaining('Aceite ou recuse novamente'),
    })
    expect(avisos.notificarAgendamento).toHaveBeenCalledWith('remarcacao', 'ped-1', ['profissional'], { motivo: null })
    expect(avisos.sincronizarEvento).toHaveBeenCalledWith('ped-1', 'atualizar')
  })

  it('concluido: só o tutor, sem WhatsApp nem agenda', async () => {
    prismaMock.agendamento.findUnique.mockResolvedValueOnce(pedido({ status: 'realizado' }))
    await avisarPedido('concluido', 'ped-1')
    expect(avisos.createGenericNotification).toHaveBeenCalledTimes(1)
    expect(avisos.createGenericNotification.mock.calls[0][0]).toMatchObject({ userId: 'u-tutor', title: 'Serviço concluído' })
    expect(avisos.notificarAgendamento).not.toHaveBeenCalled()
    expect(avisos.sincronizarEvento).not.toHaveBeenCalled()
  })

  it('sem tutor, pet, serviço, local nem preço usa textos padrão e não avisa tutor', async () => {
    prismaMock.agendamento.findUnique.mockResolvedValueOnce(
      pedido({ tutor: null, pet: null, servicoOferecido: null, localNome: null, localEndereco: null, precoConsulta: null })
    )
    await avisarPedido('novo', 'ped-1')
    expect(avisos.createGenericNotification).toHaveBeenCalledTimes(1)
    expect(avisos.createGenericNotification.mock.calls[0][0].message).toBe(
      `Tutor pediu "Banho e tosa" para seu pet (${quando}). Aceite ou recuse no seu painel.`
    )
    expect(avisos.sendPedidoServico.mock.calls[0][2].detalhes).toEqual([
      ['Serviço', 'Banho e tosa'],
      ['Pet', null],
      ['Quando', quando],
      ['Local', null],
      ['Valor', null],
    ])
  })

  it('aceito sem código gravado não quebra a mensagem', async () => {
    prismaMock.agendamento.findUnique.mockResolvedValueOnce(pedido({ startCode: null }))
    await avisarPedido('aceito', 'ped-1')
    expect(avisos.createGenericNotification.mock.calls[0][0].message).toContain('Código de início: .')
  })

  it('respeita o opt-out de e-mail do usuário', async () => {
    avisos.podeEnviarEmail.mockReturnValue(false)
    prismaMock.agendamento.findUnique.mockResolvedValueOnce(pedido())
    await avisarPedido('novo', 'ped-1')
    expect(avisos.createGenericNotification).toHaveBeenCalledTimes(2)
    expect(avisos.sendPedidoServico).not.toHaveBeenCalled()
  })

  it('falha ao avisar um usuário não impede os demais canais', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    avisos.createGenericNotification.mockRejectedValueOnce(new Error('sino fora'))
    prismaMock.agendamento.findUnique.mockResolvedValueOnce(pedido())
    await avisarPedido('novo', 'ped-1')
    expect(spy).toHaveBeenCalledWith(expect.stringContaining('Erro ao avisar novo (User ID: u-prest)'), expect.any(Error))
    expect(avisos.createGenericNotification).toHaveBeenCalledTimes(2)
    expect(avisos.notificarAgendamento).toHaveBeenCalled()
    spy.mockRestore()
  })

  it.each<EventoPedido>(['aceito', 'remarcado'])('nunca lança, mesmo se a agenda falhar (%s)', async (evento) => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    prismaMock.agendamento.findUnique.mockResolvedValueOnce(pedido())
    avisos.sincronizarEvento.mockRejectedValueOnce(new Error('google fora'))
    await expect(avisarPedido(evento, 'ped-1')).resolves.toBeUndefined()
    expect(spy).toHaveBeenCalledWith(expect.stringContaining(`Erro geral ao avisar ${evento}`), expect.any(Error))
    spy.mockRestore()
  })
})
