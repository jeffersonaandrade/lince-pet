import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const prismaMock = vi.hoisted(() => ({
  veterinario: { findFirst: vi.fn() },
  agendamento: { count: vi.fn(), findMany: vi.fn() },
}))
vi.mock('@/server/db', () => ({ prisma: prismaMock }))

import {
  agendamentosError,
  estatisticas,
  estatisticasError,
  findVeterinarioByUser,
  listAgendamentos,
  PHOTO_OPTIONS,
  pickPhoto,
  statusNormalizado,
} from '@/server/services/veterinario-dashboard'

const vet = { id: 'vet-1', precoConsulta: 150, precoConsultaOnline: 90 } as never

const agendamento = (over: Record<string, unknown> = {}) => ({
  id: 'ag-1',
  dataConsulta: '2026-10-07',
  horarioConsulta: '14:00',
  tipoConsulta: 'presencial',
  status: 'confirmado',
  precoConsulta: null,
  petId: 'pet-1',
  observacoes: 'obs',
  localNome: 'Clínica',
  localEndereco: 'Rua A',
  createdAt: new Date(2026, 9, 1, 9, 5),
  tutor: { user: { nome: 'João', sobrenome: 'Silva', celular: '81999', email: 'j@x.com' } },
  pet: { nome: 'Rex', especie: 'cão', raca: 'SRD', porte: 'médio', fotoUrl: 'https://cdn/rex.jpg' },
  ...over,
})

beforeEach(() => {
  vi.clearAllMocks()
  prismaMock.agendamento.findMany.mockResolvedValue([])
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllEnvs()
})

describe('statusNormalizado', () => {
  it.each([
    ['agendado', 'pendente'],
    ['PENDENTE', 'pendente'],
    ['marcado', 'pendente'],
    ['confirmada', 'confirmado'],
    ['Confirmado', 'confirmado'],
    ['finalizado', 'realizado'],
    ['concluido', 'realizado'],
    ['realizado', 'realizado'],
    ['cancelada', 'cancelado'],
    ['cancelado', 'cancelado'],
    ['em_atendimento', 'desconhecido'],
    [null, 'desconhecido'],
    [undefined, 'desconhecido'],
  ])('%s -> %s', (entrada, esperado) => {
    expect(statusNormalizado(entrada)).toBe(esperado)
  })
})

describe('findVeterinarioByUser', () => {
  it('busca por userId com findFirst', async () => {
    prismaMock.veterinario.findFirst.mockResolvedValueOnce({ id: 'vet-1' })
    await expect(findVeterinarioByUser('u-1')).resolves.toEqual({ id: 'vet-1' })
    expect(prismaMock.veterinario.findFirst).toHaveBeenCalledWith({ where: { userId: 'u-1' } })
  })
})

describe('estatisticas', () => {
  it('conta hoje (só agendados), semana e mês (agendados + realizados) e clientes distintos', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 9, 7, 15, 0)) // quarta-feira
    prismaMock.agendamento.count.mockResolvedValueOnce(2).mockResolvedValueOnce(5).mockResolvedValueOnce(12)
    prismaMock.agendamento.findMany.mockResolvedValueOnce([{ tutorId: 't1' }, { tutorId: 't2' }, { tutorId: 't3' }])

    await expect(estatisticas('vet-1')).resolves.toEqual({
      agendamentosHoje: 2,
      agendamentosSemana: 5,
      agendamentosMes: 12,
      totalClientes: 3,
    })

    const [hoje, semana, mes] = prismaMock.agendamento.count.mock.calls.map((c) => c[0].where)
    const agendados = ['pendente', 'confirmado', 'agendado', 'marcado', 'confirmada']
    const validos = [...agendados, 'realizado', 'finalizado', 'concluido']
    expect(hoje).toEqual({ veterinarioId: 'vet-1', dataConsulta: '2026-10-07', status: { in: agendados } })
    expect(semana).toEqual({
      veterinarioId: 'vet-1',
      dataConsulta: { gte: '2026-10-05', lte: '2026-10-11' },
      status: { in: validos },
    })
    expect(mes).toEqual({
      veterinarioId: 'vet-1',
      dataConsulta: { gte: '2026-10-01', lte: '2026-10-31' },
      status: { in: validos },
    })
    expect(prismaMock.agendamento.findMany).toHaveBeenCalledWith({
      where: { veterinarioId: 'vet-1', tutorId: { not: null } },
      distinct: ['tutorId'],
      select: { tutorId: true },
    })
  })
})

describe('mensagens de erro', () => {
  it('estatisticasError expõe stack só em development', () => {
    const erro = new Error('falhou')
    vi.stubEnv('NODE_ENV', 'development')
    expect(estatisticasError(erro)).toEqual({
      message: 'Erro interno ao buscar estatísticas',
      error: 'falhou',
      stack: erro.stack,
    })
    vi.stubEnv('NODE_ENV', 'production')
    expect(estatisticasError(erro)).toEqual({
      message: 'Erro interno ao buscar estatísticas',
      error: 'falhou',
      stack: undefined,
    })
    expect(estatisticasError(null)).toMatchObject({ error: undefined })
  })

  it('agendamentosError só expõe a mensagem em development', () => {
    vi.stubEnv('NODE_ENV', 'development')
    expect(agendamentosError(new Error('x'))).toEqual({ message: 'Erro interno ao listar agendamentos', error: 'x' })
    vi.stubEnv('NODE_ENV', 'production')
    expect(agendamentosError(new Error('x'))).toEqual({ message: 'Erro interno ao listar agendamentos', error: undefined })
  })
})

describe('listAgendamentos: filtros', () => {
  it('sem filtros consulta só pelo veterinário, ordenando por data e horário', async () => {
    await expect(listAgendamentos(vet, {})).resolves.toEqual([])
    expect(prismaMock.agendamento.findMany).toHaveBeenCalledWith({
      where: { veterinarioId: 'vet-1' },
      include: {
        tutor: { include: { user: { select: { nome: true, sobrenome: true, celular: true, email: true } } } },
        pet: true,
      },
      orderBy: [{ dataConsulta: 'asc' }, { horarioConsulta: 'asc' }],
    })
  })

  it('status em CSV é expandido para os sinônimos', async () => {
    await listAgendamentos(vet, { status: ' Pendente ,confirmado,realizado,cancelado,outro' })
    const { status } = prismaMock.agendamento.findMany.mock.calls[0][0].where
    expect(status.in.sort()).toEqual(
      [
        'pendente', 'agendado', 'marcado',
        'confirmado', 'confirmada',
        'realizado', 'concluido', 'finalizado',
        'cancelado', 'cancelada',
        'outro',
      ].sort()
    )
  })

  it('status em array também é aceito', async () => {
    await listAgendamentos(vet, { status: ['confirmado'] })
    expect(prismaMock.agendamento.findMany.mock.calls[0][0].where.status).toEqual({ in: ['confirmado', 'confirmada'] })
  })

  it('data_inicio e data_fim viram AND com gte/lte em data SQL', async () => {
    await listAgendamentos(vet, { data_inicio: '2026-10-01', data_fim: '2026-10-31T10:00:00' })
    expect(prismaMock.agendamento.findMany.mock.calls[0][0].where.AND).toEqual([
      { dataConsulta: { gte: '2026-10-01' } },
      { dataConsulta: { lte: '2026-10-31' } },
    ])
  })

  it('só data_fim: um único filtro', async () => {
    await listAgendamentos(vet, { data_fim: '2026-10-31' })
    expect(prismaMock.agendamento.findMany.mock.calls[0][0].where.AND).toEqual([{ dataConsulta: { lte: '2026-10-31' } }])
  })

  it('data inválida devolve lista vazia sem consultar o banco', async () => {
    await expect(listAgendamentos(vet, { data_inicio: 'ontem' })).resolves.toEqual([])
    expect(prismaMock.agendamento.findMany).not.toHaveBeenCalled()
  })
})

describe('listAgendamentos: formatação', () => {
  it('mapeia os campos e formata datas', async () => {
    prismaMock.agendamento.findMany.mockResolvedValueOnce([agendamento({ precoConsulta: 200 })])
    const [item] = await listAgendamentos(vet, {})
    expect(item).toEqual({
      id: 'ag-1',
      data_consulta: '07/10/2026',
      horario_consulta: '14:00',
      tipo_consulta: 'presencial',
      status: 'confirmado',
      tutor_nome: 'João',
      tutor_sobrenome: 'Silva',
      tutor_telefone: '81999',
      tutor_email: 'j@x.com',
      pet_id: 'pet-1',
      pet_nome: 'Rex',
      pet_especie: 'cão',
      pet_raca: 'SRD',
      pet_porte: 'médio',
      observacoes: 'obs',
      local_nome: 'Clínica',
      local_endereco: 'Rua A',
      preco_consulta: 200,
      pet_foto_url: 'https://cdn/rex.jpg',
      created_at: '01/10/2026 09:05',
    })
  })

  it('sem preço no agendamento usa o preço do veterinário conforme o tipo', async () => {
    prismaMock.agendamento.findMany.mockResolvedValueOnce([
      agendamento({ id: 'a', tipoConsulta: 'Online' }),
      agendamento({ id: 'b', tipoConsulta: 'remoto', precoConsulta: 0 }),
      agendamento({ id: 'c', tipoConsulta: 'presencial' }),
      agendamento({ id: 'd', tipoConsulta: null }),
    ])
    const itens = await listAgendamentos(vet, {})
    expect(itens.map((i) => i.preco_consulta)).toEqual([90, 90, 150, 150])
  })

  it('veterinário sem preços cadastrados cai para 0', async () => {
    prismaMock.agendamento.findMany.mockResolvedValueOnce([
      agendamento({ id: 'a', tipoConsulta: 'virtual' }),
      agendamento({ id: 'b', tipoConsulta: 'domicilio' }),
    ])
    const semPreco = { id: 'vet-1', precoConsulta: null, precoConsultaOnline: null } as never
    const itens = await listAgendamentos(semPreco, {})
    expect(itens.map((i) => i.preco_consulta)).toEqual([0, 0])
  })

  it('tutor e pet ausentes recebem textos padrão', async () => {
    prismaMock.agendamento.findMany.mockResolvedValueOnce([agendamento({ tutor: null, pet: null })])
    const [item] = await listAgendamentos(vet, {})
    expect(item).toMatchObject({
      tutor_nome: 'Tutor não identificado',
      tutor_sobrenome: '',
      tutor_telefone: null,
      tutor_email: null,
      pet_nome: 'Pet não identificado',
      pet_especie: '',
      pet_raca: '',
      pet_porte: '',
      pet_foto_url: undefined,
    })
  })

  it('data da consulta nula ou inválida', async () => {
    prismaMock.agendamento.findMany.mockResolvedValueOnce([
      agendamento({ id: 'a', dataConsulta: null }),
      agendamento({ id: 'b', dataConsulta: 'xx' }),
    ])
    const itens = await listAgendamentos(vet, {})
    expect(itens[0].data_consulta).toBe('null')
    expect(itens[1].data_consulta).toBe('Invalid DateTime')
  })

  it('createdAt nulo: devolve o registro de fallback e loga o erro', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    prismaMock.agendamento.findMany.mockResolvedValueOnce([
      agendamento({ id: 'a', createdAt: null }),
      agendamento({ id: 'b', createdAt: null, horarioConsulta: null, tipoConsulta: null, status: null }),
    ])
    const itens = await listAgendamentos(vet, {})
    expect(itens[0]).toEqual({
      id: 'a',
      data_consulta: 'Data inválida',
      horario_consulta: '14:00',
      tipo_consulta: 'presencial',
      status: 'confirmado',
      tutor_nome: 'Erro ao carregar',
      pet_nome: 'Erro ao carregar',
      observacoes: 'obs',
      created_at: 'Data inválida',
    })
    expect(itens[1]).toMatchObject({
      horario_consulta: 'Horário não definido',
      tipo_consulta: 'Não definido',
      status: 'Desconhecido',
    })
    expect(spy).toHaveBeenCalledTimes(2)
    spy.mockRestore()
  })
})

describe('pickPhoto', () => {
  it('devolve o primeiro campo de foto presente, na ordem de prioridade', () => {
    const arquivo = { name: 'b.png' }
    const getFile = vi.fn((nome: string) => (nome === 'image' || nome === 'avatar' ? (arquivo as never) : null))
    expect(pickPhoto(getFile)).toBe(arquivo)
    expect(getFile.mock.calls.map((c) => c[0])).toEqual(['profile_pic', 'file', 'image'])
  })

  it('sem nenhum arquivo devolve null', () => {
    expect(pickPhoto(() => null)).toBeNull()
  })

  it('opções de upload limitam tamanho e extensões', () => {
    expect(PHOTO_OPTIONS).toEqual({ size: '5mb', extnames: ['jpg', 'jpeg', 'png', 'webp', 'gif'] })
  })
})
