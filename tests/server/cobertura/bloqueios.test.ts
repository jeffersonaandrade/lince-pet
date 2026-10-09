import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const prismaMock = vi.hoisted(() => {
  const tx = {
    bloqueioAgenda: { create: vi.fn() },
    agendamento: { updateMany: vi.fn() },
    veterinario: { findUnique: vi.fn(), update: vi.fn() },
  }
  return {
    tx,
    bloqueioAgenda: { findMany: vi.fn() },
    agendamento: { findMany: vi.fn() },
    veterinario: { findUnique: vi.fn() },
    veterinarioClinica: { findFirst: vi.fn() },
    $transaction: vi.fn(async (fn: (t: typeof tx) => unknown) => fn(tx)),
  }
})
vi.mock('@/server/db', () => ({ prisma: prismaMock }))

const afterMock = vi.hoisted(() => vi.fn())
vi.mock('next/server', async (importOriginal) => ({
  ...(await importOriginal<typeof import('next/server')>()),
  after: afterMock,
}))

const inAppMock = vi.hoisted(() => vi.fn())
vi.mock('@/server/services/in-app-notifications', () => ({
  inAppNotifications: { notifyAppointmentCancelledByAgendaBlockToTutor: inAppMock },
}))
const emailMock = vi.hoisted(() => vi.fn())
vi.mock('@/server/services/notifications', () => ({ notifications: { sendAppointmentCancellation: emailMock } }))
const whatsappMock = vi.hoisted(() => vi.fn())
vi.mock('@/server/services/whatsapp-notificacoes', () => ({ notificarAgendamento: whatsappMock }))
const googleMock = vi.hoisted(() => vi.fn())
vi.mock('@/server/services/google-calendar', () => ({ googleCalendar: { sincronizarEvento: googleMock } }))

import {
  MENSAGEM_HORARIO_BLOQUEADO,
  MOTIVO_CANCELAMENTO_BLOQUEIO,
  assertVinculoAceito,
  bloqueiosDoPeriodo,
  buscarConflitos,
  criarBloqueio,
  diasSemanaDoBloqueio,
  horarioEstaBloqueado,
  horariosDoBloqueio,
  listarBloqueios,
  normalizarHorario,
  serializeBloqueio,
  serializeConflito,
  validarBloqueio,
} from '@/server/services/bloqueios'

// "Hoje" fixo: sexta, 09/10/2026. 15/10/2026 é quinta (4).
const HOJE = new Date(2026, 9, 9, 12, 0)

const tutorUser = (over: Record<string, unknown> = {}) => ({
  id: 'u-tutor',
  nome: 'Ana',
  sobrenome: 'Souza',
  email: 'ana@x.com',
  notificarEmail: 1,
  ...over,
})

const consulta = (over: Record<string, unknown> = {}) => ({
  id: 'ag-1',
  dataConsulta: '2026-10-15',
  horarioConsulta: '14:00',
  status: 'confirmado',
  tipoConsulta: 'presencial',
  paymentStatus: 'paid',
  tutor: { user: tutorUser() },
  pet: { nome: 'Rex' },
  ...over,
})

const bloqueioDb = (over: Record<string, unknown> = {}) => ({
  id: 'bl-1',
  veterinarioId: 'vet-1',
  dataInicio: '2026-10-15',
  dataFim: '2026-10-15',
  recorrente: 0,
  diasSemana: null,
  horarios: null,
  motivo: null,
  clinicaId: null,
  createdAt: new Date('2026-10-09T15:00:00Z'),
  ...over,
})

/** Executa o callback agendado em `after()` (notificações pós-resposta). */
async function rodarAfter() {
  expect(afterMock).toHaveBeenCalledTimes(1)
  await afterMock.mock.calls[0][0]()
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(HOJE)
  prismaMock.tx.bloqueioAgenda.create.mockImplementation(async ({ data }) => ({ ...bloqueioDb(), ...data }))
})

afterEach(() => {
  vi.useRealTimers()
})

describe('normalização de dados do bloqueio', () => {
  it('normaliza horário para HH:mm e trata vazio', () => {
    expect(normalizarHorario(' 14:00:00 ')).toBe('14:00')
    expect(normalizarHorario(null)).toBe('')
    expect(normalizarHorario(undefined)).toBe('')
  })

  it('ignora itens não-texto em horarios e devolve null para dia inteiro', () => {
    expect(horariosDoBloqueio({ dataInicio: 'x', dataFim: null, horarios: ['09:00:00', 3, null] as never })).toEqual([
      '09:00',
    ])
    expect(horariosDoBloqueio({ dataInicio: 'x', dataFim: null, horarios: null })).toBeNull()
  })

  it('dias da semana: só inteiros de 0 a 6; sem lista devolve vazio', () => {
    expect(
      diasSemanaDoBloqueio({ dataInicio: 'x', dataFim: null, horarios: null, diasSemana: [0, '6', 7, -1, 2.5] as never })
    ).toEqual([0, 6])
    expect(diasSemanaDoBloqueio({ dataInicio: 'x', dataFim: null, horarios: null })).toEqual([])
  })
})

describe('validarBloqueio', () => {
  it('data inexistente (31/02) é recusada com 422 "Data inválida"', async () => {
    await expect(validarBloqueio({ data_inicio: '2026-02-31' })).rejects.toMatchObject({
      status: 422,
      message: 'Data inválida',
    })
    await expect(validarBloqueio({ data_inicio: '2026-10-15', data_fim: '2026-11-31' })).rejects.toMatchObject({
      status: 422,
      message: 'Data inválida',
    })
  })

  it('aceita hoje e exatamente 31 dias; recusa 32', async () => {
    await expect(validarBloqueio({ data_inicio: '2026-10-09' })).resolves.toMatchObject({ dataInicio: '2026-10-09' })
    await expect(validarBloqueio({ data_inicio: '2026-10-10', data_fim: '2026-11-09' })).resolves.toMatchObject({
      dataFim: '2026-11-09',
    })
    await expect(validarBloqueio({ data_inicio: '2026-10-10', data_fim: '2026-11-10' })).rejects.toMatchObject({
      status: 422,
      message: 'O período de bloqueio pode ter no máximo 31 dias',
    })
  })

  it('recusa data passada e fim antes do início com mensagens próprias', async () => {
    await expect(validarBloqueio({ data_inicio: '2026-10-08' })).rejects.toMatchObject({
      message: 'Não é possível bloquear datas passadas',
    })
    await expect(validarBloqueio({ data_inicio: '2026-10-15', data_fim: '2026-10-14' })).rejects.toMatchObject({
      message: 'A data final deve ser igual ou posterior à data inicial',
    })
  })

  it('guarda motivo e ignora dias_semana em bloqueio pontual', async () => {
    await expect(
      validarBloqueio({ data_inicio: '2026-10-15', dias_semana: [1], motivo: ' Congresso ' })
    ).resolves.toEqual({
      dataInicio: '2026-10-15',
      dataFim: '2026-10-15',
      recorrente: false,
      diasSemana: null,
      horarios: null,
      motivo: 'Congresso',
    })
  })

  it('recorrente sem dias_semana usa o dia da semana do início e não tem fim', async () => {
    await expect(validarBloqueio({ data_inicio: '2026-10-15', recorrente: true })).resolves.toMatchObject({
      dataFim: null,
      recorrente: true,
      diasSemana: [4],
    })
  })

  it('recorrente com lista vazia de dias é recusado pela validação', async () => {
    await expect(validarBloqueio({ data_inicio: '2026-10-15', recorrente: true, dias_semana: [] })).rejects.toThrow()
  })
})

describe('bloqueiosDoPeriodo / horarioEstaBloqueado', () => {
  it('busca bloqueios que começam até o fim e terminam depois do início (ou sem fim)', async () => {
    prismaMock.bloqueioAgenda.findMany.mockResolvedValueOnce([])
    await bloqueiosDoPeriodo('vet-1', '2026-10-15')
    expect(prismaMock.bloqueioAgenda.findMany).toHaveBeenCalledWith({
      where: {
        veterinarioId: 'vet-1',
        dataInicio: { lte: '2026-10-15' },
        OR: [{ dataFim: null }, { dataFim: { gte: '2026-10-15' } }],
      },
      orderBy: [{ dataInicio: 'asc' }, { createdAt: 'asc' }],
    })
  })

  it('trava de horário: recorrente sem fim bloqueia as quintas à tarde', async () => {
    const quintaTarde = bloqueioDb({ dataFim: null, recorrente: 1, diasSemana: [4], horarios: ['14:00'] })
    prismaMock.bloqueioAgenda.findMany.mockResolvedValue([quintaTarde])
    await expect(horarioEstaBloqueado('vet-1', '2026-10-22', '14:00:00')).resolves.toBe(true)
    await expect(horarioEstaBloqueado('vet-1', '2026-10-22', '09:00')).resolves.toBe(false)
    await expect(horarioEstaBloqueado('vet-1', '2026-10-23', '14:00')).resolves.toBe(false)
    await expect(horarioEstaBloqueado('vet-1', '2026-10-08', '14:00')).resolves.toBe(false)

    prismaMock.bloqueioAgenda.findMany.mockResolvedValue([bloqueioDb({ dataFim: '2026-10-16' })])
    await expect(horarioEstaBloqueado('vet-1', '2026-10-16', '10:00')).resolves.toBe(true)
    await expect(horarioEstaBloqueado('vet-1', '2026-10-17', '10:00')).resolves.toBe(false)
    prismaMock.bloqueioAgenda.findMany.mockReset()
    expect(MENSAGEM_HORARIO_BLOQUEADO).toMatch(/bloqueou a agenda/)
  })
})

describe('buscarConflitos', () => {
  const input = {
    dataInicio: '2026-10-15',
    dataFim: '2026-10-15',
    recorrente: false,
    diasSemana: null,
    horarios: ['14:00'],
    motivo: null,
  }

  it('busca consultas pendentes/confirmadas do vet no período e filtra pelo horário bloqueado', async () => {
    prismaMock.agendamento.findMany.mockResolvedValueOnce([
      consulta(),
      consulta({ id: 'ag-2', horarioConsulta: '15:00' }),
      consulta({ id: 'ag-3', horarioConsulta: null }),
      consulta({ id: 'ag-4', dataConsulta: null }),
    ])
    const conflitos = await buscarConflitos('vet-1', input)
    expect(conflitos.map((c) => c.id)).toEqual(['ag-1'])
    const args = prismaMock.agendamento.findMany.mock.calls[0][0]
    expect(args.where).toEqual({
      veterinarioId: 'vet-1',
      dataConsulta: { gte: '2026-10-15', lte: '2026-10-15' },
      status: { in: ['pendente', 'confirmado'] },
    })
  })

  it('recorrente sem fim: busca a partir do início e só cancela nos dias da semana escolhidos', async () => {
    prismaMock.agendamento.findMany.mockResolvedValueOnce([
      consulta({ id: 'quinta', dataConsulta: '2026-10-22' }),
      consulta({ id: 'sexta', dataConsulta: '2026-10-23' }),
    ])
    const conflitos = await buscarConflitos('vet-1', {
      ...input,
      dataFim: null,
      recorrente: true,
      diasSemana: [4],
      horarios: null,
    })
    expect(conflitos.map((c) => c.id)).toEqual(['quinta'])
    expect(prismaMock.agendamento.findMany.mock.calls[0][0].where.dataConsulta).toEqual({ gte: '2026-10-15' })
  })
})

describe('serialização', () => {
  it('conflito mostra nome do tutor e do pet, com null quando faltam', () => {
    expect(serializeConflito(consulta() as never)).toEqual({
      id: 'ag-1',
      data_consulta: '2026-10-15',
      horario_consulta: '14:00',
      status: 'confirmado',
      tipo_consulta: 'presencial',
      tutor_nome: 'Ana Souza',
      pet_nome: 'Rex',
      payment_status: 'paid',
    })
    expect(serializeConflito(consulta({ tutor: null, pet: null }) as never)).toMatchObject({
      tutor_nome: null,
      pet_nome: null,
    })
  })

  it('bloqueio pontual de dia inteiro e recorrente com horários', () => {
    expect(serializeBloqueio(bloqueioDb({ diasSemana: [4] }) as never)).toMatchObject({
      id: 'bl-1',
      veterinario_id: 'vet-1',
      recorrente: false,
      dias_semana: [],
      dia_inteiro: true,
      horarios: [],
    })
    expect(
      serializeBloqueio(bloqueioDb({ recorrente: 1, diasSemana: [4, 2], horarios: ['08:00'], clinicaId: 'cli-1' }) as never)
    ).toMatchObject({ recorrente: true, dias_semana: [4, 2], dia_inteiro: false, horarios: ['08:00'], clinica_id: 'cli-1' })
  })
})

describe('criarBloqueio', () => {
  const BODY = { data_inicio: '2026-10-15', horarios: ['14:00'], motivo: 'Congresso' }

  it('preview só devolve os conflitos, sem gravar nem notificar', async () => {
    prismaMock.agendamento.findMany.mockResolvedValueOnce([consulta()])
    const r = await criarBloqueio('vet-1', BODY, { userId: 'u-vet', preview: true })
    expect(r.bloqueio).toBeNull()
    expect(r.conflitos).toEqual([expect.objectContaining({ id: 'ag-1', tutor_nome: 'Ana Souza' })])
    expect(prismaMock.$transaction).not.toHaveBeenCalled()
    expect(afterMock).not.toHaveBeenCalled()
  })

  it('sem conflitos: grava o bloqueio e não cancela nada', async () => {
    prismaMock.agendamento.findMany.mockResolvedValueOnce([])
    const r = await criarBloqueio('vet-1', { data_inicio: '2026-10-15' }, { userId: 'u-vet' })
    const data = prismaMock.tx.bloqueioAgenda.create.mock.calls[0][0].data
    expect(data).toMatchObject({
      veterinarioId: 'vet-1',
      dataInicio: '2026-10-15',
      dataFim: '2026-10-15',
      recorrente: 0,
      diasSemana: undefined,
      horarios: undefined,
      motivo: null,
      criadoPorUserId: 'u-vet',
      clinicaId: null,
    })
    expect(prismaMock.tx.agendamento.updateMany).not.toHaveBeenCalled()
    expect(afterMock).not.toHaveBeenCalled()
    expect(r).toEqual({ bloqueio: expect.objectContaining({ dia_inteiro: true, recorrente: false }), conflitos: [] })
  })

  it('clínica cria bloqueio recorrente: guarda clinicaId, dias da semana e horários', async () => {
    prismaMock.agendamento.findMany.mockResolvedValueOnce([])
    await criarBloqueio(
      'vet-1',
      { data_inicio: '2026-10-15', recorrente: true, dias_semana: [4], horarios: ['09:00'] },
      { userId: 'u-cli', clinicaId: 'cli-1' }
    )
    expect(prismaMock.tx.bloqueioAgenda.create.mock.calls[0][0].data).toMatchObject({
      recorrente: 1,
      dataFim: null,
      diasSemana: [4],
      horarios: ['09:00'],
      clinicaId: 'cli-1',
      criadoPorUserId: 'u-cli',
    })
  })

  it('com conflitos: cancela consultas ativas com o motivo padrão e devolve o uso mensal do vet', async () => {
    prismaMock.agendamento.findMany.mockResolvedValueOnce([consulta(), consulta({ id: 'ag-2' })])
    prismaMock.tx.veterinario.findUnique.mockResolvedValueOnce({ id: 'vet-1', monthlyAppointmentsUsed: 5 })
    const r = await criarBloqueio('vet-1', BODY, { userId: 'u-vet' })

    const upd = prismaMock.tx.agendamento.updateMany.mock.calls[0][0]
    expect(upd.where).toEqual({ id: { in: ['ag-1', 'ag-2'] }, status: { in: ['pendente', 'confirmado'] } })
    expect(upd.data).toMatchObject({
      status: 'cancelado',
      motivoCancelamento: MOTIVO_CANCELAMENTO_BLOQUEIO,
      canceladoEm: '2026-10-09 12:00:00',
    })
    expect(prismaMock.tx.veterinario.update).toHaveBeenCalledWith({
      where: { id: 'vet-1' },
      data: expect.objectContaining({ monthlyAppointmentsUsed: 3 }),
    })
    expect(r.conflitos).toHaveLength(2)
    expect(afterMock).toHaveBeenCalledTimes(1)
  })

  it('uso mensal nunca fica negativo', async () => {
    prismaMock.agendamento.findMany.mockResolvedValueOnce([consulta(), consulta({ id: 'ag-2' })])
    prismaMock.tx.veterinario.findUnique.mockResolvedValueOnce({ id: 'vet-1', monthlyAppointmentsUsed: 1 })
    await criarBloqueio('vet-1', BODY, { userId: 'u-vet' })
    expect(prismaMock.tx.veterinario.update.mock.calls[0][0].data.monthlyAppointmentsUsed).toBe(0)
  })

  it('não mexe no uso mensal se já está zerado, nulo ou o vet não existe', async () => {
    for (const vet of [{ id: 'vet-1', monthlyAppointmentsUsed: 0 }, { id: 'vet-1', monthlyAppointmentsUsed: null }, null]) {
      prismaMock.agendamento.findMany.mockResolvedValueOnce([consulta()])
      prismaMock.tx.veterinario.findUnique.mockResolvedValueOnce(vet)
      await criarBloqueio('vet-1', BODY, { userId: 'u-vet' })
    }
    expect(prismaMock.tx.agendamento.updateMany).toHaveBeenCalledTimes(3)
    expect(prismaMock.tx.veterinario.update).not.toHaveBeenCalled()
  })

  it('validação falha antes de consultar o banco', async () => {
    await expect(criarBloqueio('vet-1', { data_inicio: '2026-10-01' }, { userId: 'u' })).rejects.toMatchObject({
      status: 422,
    })
    expect(prismaMock.agendamento.findMany).not.toHaveBeenCalled()
  })
})

describe('avisos ao tutor após o bloqueio (after)', () => {
  const BODY = { data_inicio: '2026-10-15', horarios: ['14:00'], motivo: 'Congresso' }

  it('apaga o evento do Google, avisa o tutor no sino, por e-mail e WhatsApp com o motivo', async () => {
    prismaMock.agendamento.findMany.mockResolvedValueOnce([consulta()])
    prismaMock.tx.veterinario.findUnique.mockResolvedValueOnce(null)
    prismaMock.veterinario.findUnique.mockResolvedValueOnce({ id: 'vet-1', user: { nome: 'Caio', sobrenome: 'Lima' } })
    await criarBloqueio('vet-1', BODY, { userId: 'u-vet' })
    await rodarAfter()

    expect(prismaMock.veterinario.findUnique).toHaveBeenCalledWith({ where: { id: 'vet-1' }, include: { user: true } })
    expect(googleMock).toHaveBeenCalledWith('ag-1', 'cancelar')
    expect(inAppMock).toHaveBeenCalledWith({
      tutorUserId: 'u-tutor',
      veterinarioNome: 'Caio Lima',
      dataConsulta: '15/10/2026',
      horarioConsulta: '14:00',
      agendamentoId: 'ag-1',
    })
    expect(emailMock).toHaveBeenCalledWith('ana@x.com', {
      nomeTutor: 'Ana',
      nomeVeterinario: 'Caio Lima',
      data: '15/10/2026',
      horario: '14:00',
      motivo: 'Congresso',
      isVeterinario: false,
    })
    expect(whatsappMock).toHaveBeenCalledWith('cancelamento', 'ag-1', ['tutor'], { motivo: 'Congresso' })
  })

  it('sem motivo usa o padrão; tutor com e-mail desligado não recebe e-mail; vet sem user vira "Veterinário"', async () => {
    prismaMock.agendamento.findMany.mockResolvedValueOnce([consulta({ tutor: { user: tutorUser({ notificarEmail: 0 }) } })])
    prismaMock.tx.veterinario.findUnique.mockResolvedValueOnce(null)
    prismaMock.veterinario.findUnique.mockResolvedValueOnce(null)
    await criarBloqueio('vet-1', { data_inicio: '2026-10-15', horarios: ['14:00'] }, { userId: 'u-vet' })
    await rodarAfter()

    expect(inAppMock).toHaveBeenCalledWith(expect.objectContaining({ veterinarioNome: 'Veterinário' }))
    expect(emailMock).not.toHaveBeenCalled()
    expect(whatsappMock).toHaveBeenCalledWith('cancelamento', 'ag-1', ['tutor'], { motivo: MOTIVO_CANCELAMENTO_BLOQUEIO })
  })

  it('e-mail sem motivo informado usa o motivo padrão', async () => {
    prismaMock.agendamento.findMany.mockResolvedValueOnce([consulta()])
    prismaMock.tx.veterinario.findUnique.mockResolvedValueOnce(null)
    prismaMock.veterinario.findUnique.mockResolvedValueOnce(null)
    await criarBloqueio('vet-1', { data_inicio: '2026-10-15' }, { userId: 'u-vet' })
    await rodarAfter()
    expect(emailMock).toHaveBeenCalledWith('ana@x.com', expect.objectContaining({ motivo: MOTIVO_CANCELAMENTO_BLOQUEIO }))
  })

  it('consulta sem tutor: só apaga o evento do Google, sem avisos', async () => {
    prismaMock.agendamento.findMany.mockResolvedValueOnce([consulta({ tutor: null })])
    prismaMock.tx.veterinario.findUnique.mockResolvedValueOnce(null)
    prismaMock.veterinario.findUnique.mockResolvedValueOnce(null)
    await criarBloqueio('vet-1', BODY, { userId: 'u-vet' })
    await rodarAfter()

    expect(googleMock).toHaveBeenCalledWith('ag-1', 'cancelar')
    expect(inAppMock).not.toHaveBeenCalled()
    expect(whatsappMock).not.toHaveBeenCalled()
  })

  it('falha no sino/e-mail é registrada e não impede o WhatsApp nem os próximos tutores', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    prismaMock.agendamento.findMany.mockResolvedValueOnce([consulta(), consulta({ id: 'ag-2' })])
    prismaMock.tx.veterinario.findUnique.mockResolvedValueOnce(null)
    prismaMock.veterinario.findUnique.mockResolvedValueOnce(null)
    inAppMock.mockRejectedValueOnce(new Error('sino fora'))
    await criarBloqueio('vet-1', BODY, { userId: 'u-vet' })
    await rodarAfter()

    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('[Bloqueio]'), expect.any(Error))
    expect(whatsappMock).toHaveBeenCalledTimes(2)
    expect(emailMock).toHaveBeenCalledTimes(2)
    consoleSpy.mockRestore()
  })

  it('falha no Google Agenda ou WhatsApp não impede os demais avisos nem os próximos tutores', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    prismaMock.agendamento.findMany.mockResolvedValueOnce([consulta(), consulta({ id: 'ag-2' })])
    prismaMock.tx.veterinario.findUnique.mockResolvedValueOnce(null)
    prismaMock.veterinario.findUnique.mockResolvedValueOnce(null)
    googleMock.mockRejectedValueOnce(new Error('google fora'))
    whatsappMock.mockRejectedValueOnce(new Error('whatsapp fora'))
    await criarBloqueio('vet-1', BODY, { userId: 'u-vet' })
    await rodarAfter()

    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('google_agenda'), expect.any(Error))
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('whatsapp'), expect.any(Error))
    expect(inAppMock).toHaveBeenCalledTimes(2)
    expect(emailMock).toHaveBeenCalledTimes(2)
    expect(googleMock).toHaveBeenCalledTimes(2)
    expect(whatsappMock).toHaveBeenCalledTimes(2)
    consoleSpy.mockRestore()
  })

  it('aviso não quebra se data/horário sumirem entre o cancelamento e o after (defensivo)', async () => {
    const c = consulta()
    prismaMock.agendamento.findMany.mockResolvedValueOnce([c])
    prismaMock.tx.veterinario.findUnique.mockResolvedValueOnce(null)
    prismaMock.veterinario.findUnique.mockResolvedValueOnce(null)
    await criarBloqueio('vet-1', BODY, { userId: 'u-vet' })
    Object.assign(c, { dataConsulta: null, horarioConsulta: null })
    await rodarAfter()

    expect(inAppMock).toHaveBeenCalledWith(expect.objectContaining({ dataConsulta: '', horarioConsulta: '' }))
    expect(emailMock).toHaveBeenCalledWith('ana@x.com', expect.objectContaining({ data: '', horario: null }))
  })
})

describe('assertVinculoAceito', () => {
  it('clínica com vínculo aceito passa; sem vínculo recebe 404', async () => {
    prismaMock.veterinarioClinica.findFirst.mockResolvedValueOnce({ id: 'vc-1' })
    await expect(assertVinculoAceito('cli-1', 'vet-1')).resolves.toBeUndefined()
    expect(prismaMock.veterinarioClinica.findFirst).toHaveBeenCalledWith({
      where: { clinicaId: 'cli-1', veterinarioId: 'vet-1', status: 'aceito' },
    })
    prismaMock.veterinarioClinica.findFirst.mockResolvedValueOnce(null)
    await expect(assertVinculoAceito('cli-1', 'vet-2')).rejects.toMatchObject({ status: 404 })
  })
})

describe('listarBloqueios', () => {
  it('por padrão lista bloqueios que ainda valem a partir de hoje', async () => {
    prismaMock.bloqueioAgenda.findMany.mockResolvedValueOnce([])
    await listarBloqueios('vet-1')
    expect(prismaMock.bloqueioAgenda.findMany).toHaveBeenCalledWith({
      where: { veterinarioId: 'vet-1', OR: [{ dataFim: null }, { dataFim: { gte: '2026-10-09' } }] },
      orderBy: [{ dataInicio: 'asc' }, { createdAt: 'asc' }],
    })
  })

  it('filtra pelo intervalo informado', async () => {
    prismaMock.bloqueioAgenda.findMany.mockResolvedValueOnce([])
    await listarBloqueios('vet-1', '2026-11-01', '2026-11-30')
    expect(prismaMock.bloqueioAgenda.findMany.mock.calls[0][0].where).toEqual({
      veterinarioId: 'vet-1',
      OR: [{ dataFim: null }, { dataFim: { gte: '2026-11-01' } }],
      dataInicio: { lte: '2026-11-30' },
    })
  })
})
