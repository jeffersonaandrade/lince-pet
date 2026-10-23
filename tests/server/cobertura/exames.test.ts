import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('next/server', async (importOriginal) => ({
  ...(await importOriginal<typeof import('next/server')>()),
  after: (fn: () => unknown) => fn(),
}))

const prismaMock = vi.hoisted(() => {
  const m = {
    clinica: { findUnique: vi.fn(), findFirst: vi.fn(), findMany: vi.fn(), update: vi.fn() },
    exameOferecido: { findMany: vi.fn(), findFirst: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
    comboExame: { findMany: vi.fn(), findFirst: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
    comboExameItem: { deleteMany: vi.fn() },
    agendamento: { count: vi.fn(), findMany: vi.fn(), findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
    agendamentoExame: { count: vi.fn(), findMany: vi.fn() },
    bloqueioAgenda: { findMany: vi.fn() },
    pet: { findFirst: vi.fn() },
    $executeRaw: vi.fn(),
    $transaction: vi.fn(),
  }
  m.$transaction.mockImplementation(async (fn: (tx: unknown) => unknown) => fn(m))
  return m
})
vi.mock('@/server/db', () => ({ prisma: prismaMock }))

const avisoMock = vi.hoisted(() => vi.fn())
vi.mock('@/server/services/exames-avisos', () => ({ avisarExame: avisoMock }))

const encMock = vi.hoisted(() => ({ conferirEncaminhamento: vi.fn(), vincularAgendamento: vi.fn() }))
vi.mock('@/server/services/encaminhamentos', () => encMock)

import * as exames from '@/server/services/exames'

const CLINICA = 'c1'
const AGORA = new Date('2026-11-01T12:00:00Z') // domingo
const SEGUNDA = '2026-11-02'

const exame = (id: string, over: Record<string, unknown> = {}) => ({
  id,
  clinicaId: CLINICA,
  nome: id === 'e1' ? 'Hemograma' : 'Raio-X',
  descricao: null,
  preparo: id === 'e1' ? 'Jejum de 8h' : null,
  preco: id === 'e1' ? '50.00' : '120.00',
  duracaoMin: id === 'e1' ? 30 : 60,
  capacidade: 1,
  ativo: 1,
  ...over,
})

const combo = (over: Record<string, unknown> = {}) => ({
  id: 'k1',
  clinicaId: CLINICA,
  nome: 'Check-up',
  descricao: null,
  preco: '149.90',
  ativo: 1,
  itens: [{ exame: exame('e1') }, { exame: exame('e2') }],
  ...over,
})

const clinicaPublica = (over: Record<string, unknown> = {}) => ({
  id: CLINICA,
  nomeClinica: 'Clínica Centro',
  endereco: 'Rua A, 1',
  cidade: 'Recife',
  estado: 'PE',
  fotoPerfil: null,
  telefone: null,
  horariosFuncionamento: { segunda: '08:00-12:00' },
  subscriptionPlanCode: 'starter',
  examesAtivo: 1,
  rtStatus: 'aprovado',
  rtNome: 'Dra. Ana',
  rtCrmv: '1-PE',
  rtMotivo: null,
  examesOferecidos: [exame('e1'), exame('e2')],
  combosExame: [combo()],
  ...over,
})

const agendamentoCompleto = (over: Record<string, unknown> = {}) => ({
  id: 'ag-1',
  status: 'confirmado',
  dataConsulta: SEGUNDA,
  horarioConsulta: '09:00',
  inicioEm: new Date('2026-11-02T12:00:00Z'),
  fimEm: new Date('2026-11-02T13:30:00Z'),
  precoConsulta: '149.90',
  observacoes: null,
  motivoCancelamento: null,
  clinica: { id: CLINICA, nomeClinica: 'Clínica Centro', endereco: 'Rua A, 1' },
  pet: { id: 'p1', nome: 'Rex', especie: 'cão', raca: null },
  tutor: { user: { nome: 'Ana', sobrenome: null, celular: '81', email: 'a@x.com' } },
  exames: [{ nome: 'Hemograma', preparo: 'Jejum', comboId: 'k1' }],
  laudo: null,
  ...over,
})

beforeEach(() => {
  vi.clearAllMocks()
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(AGORA)
  prismaMock.$transaction.mockImplementation(async (fn: (tx: unknown) => unknown) => fn(prismaMock))
  prismaMock.clinica.findFirst.mockResolvedValue(clinicaPublica())
  prismaMock.clinica.findUnique.mockResolvedValue(clinicaPublica())
  prismaMock.exameOferecido.findMany.mockResolvedValue([exame('e1'), exame('e2')])
  prismaMock.comboExame.findMany.mockResolvedValue([combo()])
  prismaMock.agendamento.count.mockResolvedValue(0)
  prismaMock.agendamento.findMany.mockResolvedValue([])
  prismaMock.bloqueioAgenda.findMany.mockResolvedValue([])
  prismaMock.pet.findFirst.mockResolvedValue({ id: 'p1', tutorId: 't1' })
  prismaMock.agendamento.create.mockImplementation(async () => agendamentoCompleto())
  prismaMock.agendamento.update.mockImplementation(async () => agendamentoCompleto())
})

afterEach(() => vi.useRealTimers())

describe('painel da clínica', () => {
  it('catálogo com plano, visibilidade, uso do mês, RT, exames e combos', async () => {
    prismaMock.agendamento.count.mockResolvedValue(7)
    const r = await exames.catalogoDaClinica(CLINICA)
    expect(r).toMatchObject({
      exames_ativo: true,
      plano_com_exames: true,
      visivel: true,
      uso_mes: { usados: 7, limite: 100 },
      rt: { rt_nome: 'Dra. Ana', rt_status: 'aprovado' },
    })
    expect(r.exames[0]).toEqual({ id: 'e1', nome: 'Hemograma', descricao: null, preparo: 'Jejum de 8h', preco: 50, duracao_min: 30, capacidade: 1, ativo: true })
    expect(r.combos[0]).toMatchObject({ preco: 149.9, preco_avulso: 170, duracao_min: 90, disponivel: true })
    expect(prismaMock.agendamento.count.mock.calls[0][0].where).toMatchObject({ clinicaId: CLINICA, tipoConsulta: 'exame' })
  })

  it('sem plano: limite 0 e invisível; clínica inexistente: 404', async () => {
    prismaMock.clinica.findUnique.mockResolvedValueOnce(clinicaPublica({ subscriptionPlanCode: 'none' }))
    expect(await exames.catalogoDaClinica(CLINICA)).toMatchObject({ plano_com_exames: false, visivel: false, uso_mes: { limite: 0 } })
    prismaMock.clinica.findUnique.mockResolvedValueOnce(null)
    await expect(exames.catalogoDaClinica(CLINICA)).rejects.toMatchObject({ status: 404 })
  })

  it('ligar o módulo exige plano; desligar sempre pode', async () => {
    await exames.alternarModulo(CLINICA, true)
    expect(prismaMock.clinica.update.mock.calls[0][0].data.examesAtivo).toBe(1)
    await exames.alternarModulo(CLINICA, false)
    expect(prismaMock.clinica.update.mock.calls[1][0].data.examesAtivo).toBe(0)
    prismaMock.clinica.findUnique.mockResolvedValueOnce(clinicaPublica({ subscriptionPlanCode: 'free' }))
    await expect(exames.alternarModulo(CLINICA, 'true')).rejects.toMatchObject({ status: 403 })
  })
})

describe('catálogo: exames', () => {
  const body = { nome: 'Ultrassom', preco: 200, duracao_min: 45, preparo: 'Bexiga cheia', capacidade: 2 }

  it('cria ativo, com capacidade padrão 1', async () => {
    prismaMock.exameOferecido.create.mockImplementation(async ({ data }) => ({ id: 'n', ...data }))
    const r = await exames.criarExame(CLINICA, { ...body, capacidade: undefined })
    expect(r).toMatchObject({ nome: 'Ultrassom', capacidade: 1, ativo: true, preparo: 'Bexiga cheia' })
  })

  it('atualiza (inclusive desativar); exame de outra clínica: 404', async () => {
    prismaMock.exameOferecido.findFirst.mockResolvedValueOnce(exame('e1'))
    prismaMock.exameOferecido.update.mockImplementation(async ({ data }) => ({ ...exame('e1'), ...data }))
    expect((await exames.atualizarExame(CLINICA, 'e1', { ...body, ativo: false })).ativo).toBe(false)
    expect(prismaMock.exameOferecido.update.mock.calls[0][0].data).toMatchObject({ capacidade: 2, ativo: 0 })
    prismaMock.exameOferecido.findFirst.mockResolvedValueOnce(null)
    await expect(exames.atualizarExame(CLINICA, 'x', body)).rejects.toMatchObject({ status: 404 })
  })

  it('remover: com agendamento futuro só desativa; sem, apaga', async () => {
    prismaMock.exameOferecido.findFirst.mockResolvedValue(exame('e1'))
    prismaMock.agendamentoExame.count.mockResolvedValueOnce(2)
    expect(await exames.removerExame(CLINICA, 'e1')).toEqual({ removido: false, desativado: true })
    expect(prismaMock.exameOferecido.delete).not.toHaveBeenCalled()
    prismaMock.agendamentoExame.count.mockResolvedValueOnce(0)
    expect(await exames.removerExame(CLINICA, 'e1')).toEqual({ removido: true, desativado: false })
  })
})

describe('catálogo: combos', () => {
  const body = { nome: 'Check-up', preco: 149.9, exame_ids: ['e1', 'e2'] }

  it('cria com 2 exames da clínica', async () => {
    prismaMock.comboExame.create.mockResolvedValue(combo())
    expect((await exames.criarCombo(CLINICA, body)).disponivel).toBe(true)
    expect(prismaMock.comboExame.create.mock.calls[0][0].data.itens.create).toEqual([{ exameId: 'e1' }, { exameId: 'e2' }])
    expect(prismaMock.comboExame.create.mock.calls[0][0].data.ativo).toBe(1)
  })

  it('exame de outra clínica no combo: 422', async () => {
    prismaMock.exameOferecido.findMany.mockResolvedValueOnce([exame('e1'), exame('e2', { clinicaId: 'outra' })])
    await expect(exames.criarCombo(CLINICA, body)).rejects.toMatchObject({ status: 422 })
  })

  it('atualizar troca os itens na transação; inexistente: 404', async () => {
    prismaMock.comboExame.findFirst.mockResolvedValueOnce(combo())
    prismaMock.comboExame.update.mockResolvedValue(combo({ ativo: 0 }))
    expect((await exames.atualizarCombo(CLINICA, 'k1', { ...body, ativo: false })).disponivel).toBe(false)
    expect(prismaMock.comboExameItem.deleteMany).toHaveBeenCalledWith({ where: { comboId: 'k1' } })
    expect(prismaMock.comboExame.update.mock.calls[0][0].data.ativo).toBe(0)

    prismaMock.comboExame.findFirst.mockResolvedValueOnce(combo())
    await exames.atualizarCombo(CLINICA, 'k1', body)
    expect(prismaMock.comboExame.update.mock.calls[1][0].data.ativo).toBeUndefined()

    prismaMock.comboExame.findFirst.mockResolvedValueOnce(null)
    await expect(exames.atualizarCombo(CLINICA, 'x', body)).rejects.toMatchObject({ status: 404 })
  })

  it('remover', async () => {
    prismaMock.comboExame.findFirst.mockResolvedValueOnce(combo())
    expect(await exames.removerCombo(CLINICA, 'k1')).toEqual({ removido: true })
  })

  it('combo com exame inativo não aparece para o público', () => {
    expect(exames.serializarCombo(combo({ itens: [{ exame: exame('e1') }, { exame: exame('e2', { ativo: 0 }) }] }) as never).disponivel).toBe(false)
  })
})

describe('busca e perfil público', () => {
  it('busca só clínicas visíveis (módulo, RT aprovado, plano, usuário ativo), filtrando nome e cidade', async () => {
    prismaMock.clinica.findMany.mockResolvedValue([clinicaPublica({ combosExame: [combo(), combo({ id: 'k2', ativo: 0 })] })])
    const r = await exames.buscarExames({ search: 'hemo', cidade: 'Recife' })
    const where = prismaMock.clinica.findMany.mock.calls[0][0].where
    expect(where).toMatchObject({
      examesAtivo: 1,
      rtStatus: 'aprovado',
      subscriptionPlanCode: { in: ['starter', 'clinic', 'clinic_pro'] },
      user: { ativo: 1 },
      cidade: { contains: 'Recife', mode: 'insensitive' },
      examesOferecidos: { some: { ativo: 1, nome: { contains: 'hemo', mode: 'insensitive' } } },
    })
    expect(r[0].clinica).toMatchObject({ id: CLINICA, nome: 'Clínica Centro' })
    expect(r[0].combos.map((c) => c.id)).toEqual(['k1'])

    await exames.buscarExames({})
    expect(prismaMock.clinica.findMany.mock.calls[1][0].where.cidade).toBeUndefined()
  })

  it('perfil público: null quando invisível ou sem exames', async () => {
    expect(await exames.examesDaClinicaPublica(CLINICA)).not.toBeNull()
    prismaMock.clinica.findFirst.mockResolvedValueOnce(null)
    expect(await exames.examesDaClinicaPublica(CLINICA)).toBeNull()
    prismaMock.clinica.findFirst.mockResolvedValueOnce(clinicaPublica({ examesOferecidos: [] }))
    expect(await exames.examesDaClinicaPublica(CLINICA)).toBeNull()
  })
})

describe('escolhaDoPedido', () => {
  const c = clinicaPublica() as never
  it('combo usa o preço do combo; avulsos somam', () => {
    expect(exames.escolhaDoPedido(c, { combo_id: 'k1' })).toMatchObject({ preco: 149.9, duracaoMin: 90 })
    expect(exames.escolhaDoPedido(c, { exame_ids: ['e1', 'e1'] })).toMatchObject({ preco: 50, duracaoMin: 30, combo: null })
  })
  it('combo ou exame indisponível: 404; nada escolhido: 400', () => {
    expect(() => exames.escolhaDoPedido(c, { combo_id: 'x' })).toThrow(/Combo indisponível/)
    expect(() => exames.escolhaDoPedido(c, { exame_ids: ['x'] })).toThrow(/Exame indisponível/)
    expect(() => exames.escolhaDoPedido(c, {})).toThrow(/pelo menos um/)
  })
})

describe('disponibilidade', () => {
  it('blocos de 30 min em que o pedido inteiro cabe e há vaga', async () => {
    prismaMock.agendamento.findMany.mockResolvedValue([
      { inicioEm: new Date('2026-11-02T12:00:00Z'), fimEm: new Date('2026-11-02T12:30:00Z'), exames: [{ exameId: 'e1' }, { exameId: null }] },
      { inicioEm: null, fimEm: null, exames: [] },
    ])
    const r = await exames.disponibilidadeExames(CLINICA, { exame_ids: ['e1'] }, SEGUNDA)
    expect(r).toMatchObject({ data: SEGUNDA, duracao_min: 30, preco: 50 })
    expect(r.horarios).toEqual(['08:00', '08:30', '09:30', '10:00', '10:30', '11:00', '11:30'])
  })

  it('combo de 90 min não começa depois das 10:30; dia fechado ou data inválida', async () => {
    expect((await exames.disponibilidadeExames(CLINICA, { combo_id: 'k1' }, SEGUNDA)).horarios.at(-1)).toBe('10:30')
    expect((await exames.disponibilidadeExames(CLINICA, { combo_id: 'k1' }, '2026-11-03')).horarios).toEqual([])
    await expect(exames.disponibilidadeExames(CLINICA, { combo_id: 'k1' }, '02/11/2026')).rejects.toMatchObject({ status: 400 })
    await expect(exames.disponibilidadeExames(CLINICA, { combo_id: 'k1' }, '2026-13-45')).rejects.toMatchObject({ status: 400 })
  })

  it('bloqueio do dia inteiro tira todos os horários; clínica invisível: 404', async () => {
    prismaMock.bloqueioAgenda.findMany.mockResolvedValueOnce([{ dataInicio: SEGUNDA, dataFim: null, horarios: null }])
    expect((await exames.disponibilidadeExames(CLINICA, { exame_ids: ['e1'] }, SEGUNDA)).horarios).toEqual([])
    prismaMock.clinica.findFirst.mockResolvedValueOnce(null)
    await expect(exames.disponibilidadeExames(CLINICA, { exame_ids: ['e1'] }, SEGUNDA)).rejects.toMatchObject({ status: 404 })
  })
})

describe('agendarExame', () => {
  const body = { pet_id: 'p1', combo_id: 'k1', data: SEGUNDA, horario: '09:00' }

  it('combo: confirmado, preço do combo, itens copiados, trava por clínica e aviso', async () => {
    const r = await exames.agendarExame({ id: 't1' }, CLINICA, { ...body, observacoes: 'Bravo' })

    const data = prismaMock.agendamento.create.mock.calls[0][0].data
    expect(data).toMatchObject({
      tutorId: 't1',
      clinicaId: CLINICA,
      status: 'confirmado',
      tipoConsulta: 'exame',
      precoConsulta: 149.9,
      observacoes: 'Bravo',
      localNome: 'Clínica Centro',
      dataConsulta: SEGUNDA,
      horarioConsulta: '09:00',
    })
    expect(data.inicioEm).toEqual(new Date('2026-11-02T12:00:00Z'))
    expect(data.fimEm).toEqual(new Date('2026-11-02T13:30:00Z'))
    expect(data.exames.create).toEqual([
      expect.objectContaining({ exameId: 'e1', comboId: 'k1', preco: 0, nome: 'Hemograma', preparo: 'Jejum de 8h' }),
      expect.objectContaining({ exameId: 'e2', comboId: 'k1', preco: 0 }),
    ])
    expect(prismaMock.$executeRaw).toHaveBeenCalled()
    expect(avisoMock).toHaveBeenCalledWith('novo', 'ag-1')
    expect(r).toMatchObject({ id: 'ag-1', preco: 149.9, exames: [{ nome: 'Hemograma', combo: true }] })
  })

  it('avulso guarda o preço de cada exame; encaminhamento é conferido e vinculado', async () => {
    await exames.agendarExame({ id: 't1' }, CLINICA, { pet_id: 'p1', exame_ids: ['e1'], data: SEGUNDA, horario: '08:00', encaminhamento_id: 'enc1' })
    expect(prismaMock.agendamento.create.mock.calls[0][0].data.exames.create[0]).toMatchObject({ comboId: null, preco: '50.00' })
    expect(encMock.conferirEncaminhamento).toHaveBeenCalledWith('enc1', { tutorId: 't1', petId: 'p1', clinicaId: CLINICA })
    expect(encMock.vincularAgendamento).toHaveBeenCalledWith('enc1', 'ag-1')
  })

  it('capacidade cheia: 409 (antes e dentro da transação)', async () => {
    const cheio = [{ inicioEm: new Date('2026-11-02T12:00:00Z'), fimEm: new Date('2026-11-02T12:30:00Z'), exames: [{ exameId: 'e1' }] }]
    prismaMock.agendamento.findMany.mockResolvedValueOnce(cheio)
    await expect(exames.agendarExame({ id: 't1' }, CLINICA, body)).rejects.toMatchObject({ status: 409, message: exames.MENSAGEM_LOTADO })

    prismaMock.agendamento.findMany.mockResolvedValueOnce([]).mockResolvedValueOnce(cheio)
    await expect(exames.agendarExame({ id: 't1' }, CLINICA, body)).rejects.toMatchObject({ status: 409 })
    expect(prismaMock.agendamento.create).not.toHaveBeenCalled()
  })

  it.each([
    ['pet de outro tutor', () => prismaMock.pet.findFirst.mockResolvedValueOnce(null), body, 404],
    ['horário passado', () => null, { ...body, data: '2026-10-26' }, 400],
    ['fora do expediente', () => null, { ...body, horario: '11:00' }, 400],
    ['data inexistente', () => null, { ...body, data: '2026-02-30' }, 400],
    ['bloqueio da clínica', () => prismaMock.bloqueioAgenda.findMany.mockResolvedValueOnce([{ dataInicio: SEGUNDA, dataFim: null, horarios: null }]), body, 400],
    ['limite do plano', () => prismaMock.agendamento.count.mockResolvedValueOnce(100), body, 403],
    ['inadimplente (plano none)', () => prismaMock.clinica.findFirst.mockResolvedValueOnce(clinicaPublica({ subscriptionPlanCode: 'none' })), body, 403],
  ])('%s: recusa', async (_, preparar, corpo, status) => {
    preparar()
    await expect(exames.agendarExame({ id: 't1' }, CLINICA, corpo)).rejects.toMatchObject({ status })
    expect(prismaMock.agendamento.create).not.toHaveBeenCalled()
  })
})

describe('ações do tutor', () => {
  const doTutor = (over: Record<string, unknown> = {}) => ({ id: 'ag-1', tutorId: 't1', clinicaId: CLINICA, status: 'confirmado', ...over })

  it('ehAgendamentoDeExame', async () => {
    prismaMock.agendamento.count.mockResolvedValueOnce(1)
    expect(await exames.ehAgendamentoDeExame('ag-1', 't1')).toBe(true)
    expect(await exames.ehAgendamentoDeExame('ag-1', 't1')).toBe(false)
  })

  it('cancelar: grava motivo (ou o padrão) e avisa a clínica', async () => {
    prismaMock.agendamento.findFirst.mockResolvedValue(doTutor())
    await exames.cancelarExamePeloTutor('t1', 'ag-1', 'Viagem')
    expect(prismaMock.agendamento.update.mock.calls[0][0].data).toMatchObject({ status: 'cancelado', motivoCancelamento: 'Viagem' })
    expect(avisoMock).toHaveBeenCalledWith('cancelado_tutor', 'ag-1', 'Viagem')
    await exames.cancelarExamePeloTutor('t1', 'ag-1')
    expect(prismaMock.agendamento.update.mock.calls[1][0].data.motivoCancelamento).toBeTruthy()
  })

  it('cancelar exame já cancelado: 400; de outro tutor: 404', async () => {
    prismaMock.agendamento.findFirst.mockResolvedValueOnce(doTutor({ status: 'cancelado' }))
    await expect(exames.cancelarExamePeloTutor('t1', 'ag-1')).rejects.toMatchObject({ status: 400 })
    prismaMock.agendamento.findFirst.mockResolvedValueOnce(null)
    await expect(exames.cancelarExamePeloTutor('t2', 'ag-1')).rejects.toMatchObject({ status: 404 })
  })

  it('remarcar: mesma duração, ignora o próprio agendamento na capacidade e avisa', async () => {
    prismaMock.agendamento.findFirst.mockResolvedValue(doTutor())
    prismaMock.agendamentoExame.findMany.mockResolvedValue([
      { duracaoMin: 30, exame: exame('e1') },
      { duracaoMin: 60, exame: exame('e2') },
    ])
    const disp = await exames.disponibilidadeParaRemarcar('t1', 'ag-1', SEGUNDA)
    expect(disp).toMatchObject({ duracao_min: 90, horarios: ['08:00', '08:30', '09:00', '09:30', '10:00', '10:30'] })
    expect(prismaMock.agendamento.findMany.mock.calls[0][0].where.id).toEqual({ not: 'ag-1' })

    await exames.remarcarExame('t1', 'ag-1', { data: SEGUNDA, horario: '10:00' })
    expect(prismaMock.agendamento.update.mock.calls[0][0].data).toMatchObject({ horarioConsulta: '10:00', dataConsulta: SEGUNDA })
    expect(avisoMock).toHaveBeenCalledWith('remarcado', 'ag-1')
  })

  it('remarcar com exame que saiu do catálogo ou agendamento cancelado: 400', async () => {
    prismaMock.agendamento.findFirst.mockResolvedValueOnce(doTutor())
    prismaMock.agendamentoExame.findMany.mockResolvedValueOnce([{ duracaoMin: 30, exame: null }])
    await expect(exames.remarcarExame('t1', 'ag-1', { data: SEGUNDA, horario: '10:00' })).rejects.toThrow(/não é mais oferecido/)
    prismaMock.agendamento.findFirst.mockResolvedValueOnce(doTutor({ status: 'cancelado' }))
    await expect(exames.disponibilidadeParaRemarcar('t1', 'ag-1', SEGUNDA)).rejects.toMatchObject({ status: 400 })
  })
})

describe('agenda da clínica', () => {
  it('lista exames da clínica no período (padrão: 30 dias a partir de hoje)', async () => {
    prismaMock.agendamento.findMany.mockResolvedValueOnce([agendamentoCompleto({ laudo: { nomeArquivo: 'l.pdf', enviadoEm: new Date('2026-11-02T15:00:00Z') } })])
    const r = await exames.agendaDeExames(CLINICA, {})
    const where = prismaMock.agendamento.findMany.mock.calls[0][0].where
    expect(where).toMatchObject({ clinicaId: CLINICA, tipoConsulta: 'exame' })
    expect(where.status).toBeUndefined()
    expect(r[0]).toMatchObject({ tutor: { nome: 'Ana', email: 'a@x.com' }, laudo: { nome_arquivo: 'l.pdf', enviado_em: '2026-11-02T15:00:00.000Z' } })

    await exames.agendaDeExames(CLINICA, { de: SEGUNDA, ate: '2026-11-05', status: 'confirmado' })
    expect(prismaMock.agendamento.findMany.mock.calls[1][0].where.status).toBe('confirmado')
  })

  it('serializa com dados faltando', () => {
    const r = exames.serializarAgendamentoExame(
      agendamentoCompleto({ inicioEm: null, fimEm: null, precoConsulta: null, clinica: null, pet: null, tutor: null, exames: [{ nome: 'X', preparo: null, comboId: null }], laudo: { nomeArquivo: null, enviadoEm: null } }) as never
    )
    expect(r).toMatchObject({ inicio_em: null, fim_em: null, preco: 0, clinica: null, pet: null, tutor: null, exames: [{ combo: false }], laudo: { enviado_em: null } })
  })

  it('marcar realizado: só confirmado e já começado', async () => {
    prismaMock.agendamento.findFirst.mockResolvedValueOnce({ id: 'ag-1', status: 'confirmado', inicioEm: new Date('2026-11-01T11:00:00Z') })
    expect(await exames.marcarRealizado(CLINICA, 'ag-1')).toEqual({ status: 'realizado' })
    prismaMock.agendamento.findFirst.mockResolvedValueOnce({ id: 'ag-1', status: 'confirmado', inicioEm: new Date('2026-11-02T12:00:00Z') })
    await expect(exames.marcarRealizado(CLINICA, 'ag-1')).rejects.toThrow(/ainda não começou/)
    prismaMock.agendamento.findFirst.mockResolvedValueOnce({ id: 'ag-1', status: 'cancelado' })
    await expect(exames.marcarRealizado(CLINICA, 'ag-1')).rejects.toThrow(/confirmados/)
    prismaMock.agendamento.findFirst.mockResolvedValueOnce(null)
    await expect(exames.marcarRealizado(CLINICA, 'ag-1')).rejects.toMatchObject({ status: 404 })
  })

  it('cancelar pela clínica exige motivo e avisa o tutor', async () => {
    await expect(exames.cancelarPelaClinica(CLINICA, 'ag-1', '  ')).rejects.toThrow(/motivo/)
    await expect(exames.cancelarPelaClinica(CLINICA, 'ag-1', 42)).rejects.toThrow(/motivo/)
    prismaMock.agendamento.findFirst.mockResolvedValueOnce({ id: 'ag-1', status: 'confirmado' })
    expect(await exames.cancelarPelaClinica(CLINICA, 'ag-1', 'Aparelho quebrado')).toEqual({ status: 'cancelado' })
    expect(avisoMock).toHaveBeenCalledWith('cancelado_clinica', 'ag-1', 'Aparelho quebrado')
    prismaMock.agendamento.findFirst.mockResolvedValueOnce({ id: 'ag-1', status: 'realizado' })
    await expect(exames.cancelarPelaClinica(CLINICA, 'ag-1', 'x')).rejects.toMatchObject({ status: 400 })
  })

  it('carregarAgendamentoExame filtra por tipo exame', async () => {
    prismaMock.agendamento.findFirst.mockResolvedValueOnce(null)
    await exames.carregarAgendamentoExame('ag-1')
    expect(prismaMock.agendamento.findFirst.mock.calls[0][0].where).toEqual({ id: 'ag-1', tipoConsulta: 'exame' })
  })
})
