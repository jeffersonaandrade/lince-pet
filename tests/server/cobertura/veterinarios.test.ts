import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Prisma } from '@prisma/client'
import { DateTime } from 'luxon'

const prismaMock = vi.hoisted(() => {
  const tx = {
    user: { create: vi.fn() },
    veterinario: { create: vi.fn() },
    especialidadeRelacionamento: { findMany: vi.fn(), deleteMany: vi.fn(), createMany: vi.fn() },
    veterinarioPlano: { findMany: vi.fn(), deleteMany: vi.fn(), createMany: vi.fn() },
  }
  return {
    tx,
    veterinario: { findFirst: vi.fn(), findMany: vi.fn(), update: vi.fn() },
    user: { update: vi.fn() },
    especialidadeRelacionamento: { findMany: vi.fn() },
    experienciaVeterinario: { deleteMany: vi.fn(), create: vi.fn() },
    veterinarioEndereco: { findFirst: vi.fn() },
    $queryRaw: vi.fn(),
    $transaction: vi.fn(async (arg: unknown) =>
      typeof arg === 'function' ? (arg as (t: typeof tx) => unknown)(tx) : Promise.all(arg as unknown[])
    ),
  }
})
vi.mock('@/server/db', () => ({ prisma: prismaMock }))

const assinatura = vi.hoisted(() => ({ canCreateAppointment: vi.fn() }))
vi.mock('@/server/services/subscription', () => assinatura)

const senha = vi.hoisted(() => ({ hashPassword: vi.fn() }))
vi.mock('@/server/auth/password', () => senha)

import {
  dateColumn,
  dirtyFields,
  enderecoWriteData,
  findEnderecoPrincipalOuAtivo,
  findVeterinarioByUser,
  findVeterinarios,
  getVeterinarioById,
  mergeEndereco,
  registerVeterinario,
  replaceExperiencias,
  saveUserNome,
  saveVeterinario,
  searchVeterinarios,
  serializeEndereco,
  serializeExperiencia,
  serializeVeterinario,
  syncEspecialidadesVeterinario,
  syncPlanosVeterinario,
  toDateColumn,
  toJsonColumn,
  toTinyInt,
} from '@/server/services/veterinarios'
import { PLANO_PADRAO } from '@/server/services/assinante'

beforeEach(() => {
  vi.clearAllMocks()
  vi.spyOn(console, 'log').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
  prismaMock.veterinario.findMany.mockResolvedValue([])
  prismaMock.especialidadeRelacionamento.findMany.mockResolvedValue([])
  prismaMock.$queryRaw.mockResolvedValue([])
  assinatura.canCreateAppointment.mockResolvedValue({ allowed: true })
  senha.hashPassword.mockResolvedValue('hash-seguro')
})

/** Reconstrói o Prisma.Sql a partir da chamada ao tagged template `$queryRaw`. */
const sqlDaBusca = () => {
  const [strings, ...values] = prismaMock.$queryRaw.mock.calls[0]
  return Prisma.sql(strings as TemplateStringsArray, ...values)
}

describe('conversões de coluna', () => {
  it('toJsonColumn: undefined, string JSON, null e objeto', () => {
    expect(toJsonColumn(undefined)).toBeUndefined()
    expect(toJsonColumn('{"a":1}')).toEqual({ a: 1 })
    expect(toJsonColumn('null')).toBe(Prisma.JsonNull)
    expect(toJsonColumn(null)).toBe(Prisma.JsonNull)
    expect(toJsonColumn({ b: 2 })).toEqual({ b: 2 })
  })

  it('toTinyInt preserva null/undefined e converte o resto em número', () => {
    expect(toTinyInt(null)).toBeNull()
    expect(toTinyInt(undefined)).toBeUndefined()
    expect(toTinyInt(true)).toBe(1)
    expect(toTinyInt(false)).toBe(0)
    expect(toTinyInt('1')).toBe(1)
  })

  it('dateColumn usa o dia UTC como meia-noite local', () => {
    expect(dateColumn(null)).toBeNull()
    const dt = dateColumn(new Date(Date.UTC(2024, 2, 5)))!
    expect(DateTime.isDateTime(dt)).toBe(true)
    expect(dt.toISODate()).toBe('2024-03-05')
    expect(dt.hour).toBe(0)
  })

  it('toDateColumn aceita vários formatos e rejeita inválidos', () => {
    expect(toDateColumn(undefined)).toBeUndefined()
    expect(toDateColumn(null)).toBeNull()
    expect(toDateColumn('')).toBeNull()
    const d = new Date()
    expect(toDateColumn(d)).toBe(d)
    expect(toDateColumn('2024-03-05T10:00:00Z')).toEqual(new Date(Date.UTC(2024, 2, 5)))
    expect(toDateColumn('March 5, 2024')).toEqual(new Date(Date.UTC(2024, 2, 5)))
    expect(() => toDateColumn('abc')).toThrow('Invalid date value "abc"')
  })
})

describe('serialização', () => {
  it('serializeEndereco remove a coluna interna de horários', () => {
    expect(serializeEndereco({ id: 'e1', horariosDisponibilidadeColuna: 'x', cidade: 'Recife' } as never)).toEqual({
      id: 'e1',
      cidade: 'Recife',
    })
  })

  it('serializeExperiencia converte as datas', () => {
    const out = serializeExperiencia({ id: 'x', dataInicio: new Date(Date.UTC(2020, 0, 2)), dataFim: null } as never)
    expect(out.dataInicio!.toISODate()).toBe('2020-01-02')
    expect(out.dataFim).toBeNull()
  })

  it('serializeVeterinario tira a senha do usuário e serializa endereços e experiências', () => {
    const out = serializeVeterinario({
      id: 'vet-1',
      user: { id: 'u', nome: 'Ana', password: 'segredo', googleAccessToken: 't' },
      enderecos: [{ id: 'e1', horariosDisponibilidadeColuna: 'x' }],
      experiencias: [{ id: 'x1', dataInicio: null, dataFim: null }],
    } as never)
    expect(out.user).toEqual({ id: 'u', nome: 'Ana' })
    expect(out.enderecos).toEqual([{ id: 'e1' }])
    expect(out.experiencias).toEqual([{ id: 'x1', dataInicio: null, dataFim: null }])
  })

  it('serializeVeterinario: user null continua null; sem a chave user não cria', () => {
    expect(serializeVeterinario({ id: 'v', user: null } as never).user).toBeNull()
    expect('user' in serializeVeterinario({ id: 'v' } as never)).toBe(false)
  })
})

describe('mergeEndereco / enderecoWriteData', () => {
  it('aceita propriedades e nomes de coluna, ignora desconhecidas undefined', () => {
    expect(
      mergeEndereco({ rua: 'A', nome_clinica: 'C', horarios_funcionamento: { seg: [] }, created_at: 'x', lixo: undefined })
    ).toEqual({ rua: 'A', nomeClinica: 'C', horariosDisponibilidade: { seg: [] }, createdAt: 'x' })
  })

  it('chave desconhecida com valor falha como o Lucid', () => {
    expect(() => mergeEndereco({ lixo: 1 })).toThrow(
      'Cannot define "lixo" on "VeterinarioEndereco" model, since it is not defined as a model property'
    )
  })

  it('converte booleanos em tinyint e horários para JSON', () => {
    expect(enderecoWriteData({ aceitaEmergencia: true, isPrimary: false, ativo: '1', horariosDisponibilidade: '{"a":1}' })).toEqual({
      aceitaEmergencia: 1,
      isPrimary: 0,
      ativo: 1,
      horariosDisponibilidade: { a: 1 },
    })
    expect(enderecoWriteData({ horariosDisponibilidade: null }).horariosDisponibilidade).toBe(Prisma.DbNull)
    expect(enderecoWriteData({ rua: 'A' })).toEqual({ rua: 'A' })
  })
})

describe('persistência', () => {
  it('dirtyFields mantém só o que mudou', () => {
    expect(dirtyFields({ a: 1, b: 2 }, { a: 1, b: 3, c: 4 })).toEqual({ b: 3, c: 4 })
  })

  it('saveVeterinario sem mudanças não grava', async () => {
    await saveVeterinario({ id: 'v', bio: 'x' } as never, { bio: 'x' })
    expect(prismaMock.veterinario.update).not.toHaveBeenCalled()
  })

  it('saveVeterinario grava só o diff com updatedAt e atualiza o objeto', async () => {
    const vet = { id: 'v', bio: 'x', crmv: '1' }
    await saveVeterinario(vet as never, { bio: 'y', crmv: '1' })
    const args = prismaMock.veterinario.update.mock.calls[0][0]
    expect(args.where).toEqual({ id: 'v' })
    expect(args.data).toMatchObject({ bio: 'y' })
    expect(args.data).not.toHaveProperty('crmv')
    expect(args.data.updatedAt).toBeInstanceOf(Date)
    expect(vet.bio).toBe('y')
  })

  it('saveVeterinario usa o client de transação recebido', async () => {
    const db = { veterinario: { update: vi.fn() } }
    await saveVeterinario({ id: 'v', bio: 'x' } as never, { bio: 'z' }, db as never)
    expect(db.veterinario.update).toHaveBeenCalled()
    expect(prismaMock.veterinario.update).not.toHaveBeenCalled()
  })

  it('saveUserNome só grava quando o nome muda', async () => {
    const user = { id: 'u', nome: 'Ana' }
    await saveUserNome(user, 'Ana')
    expect(prismaMock.user.update).not.toHaveBeenCalled()
    await saveUserNome(user, 'Bia')
    expect(prismaMock.user.update.mock.calls[0][0]).toMatchObject({ where: { id: 'u' }, data: { nome: 'Bia' } })
    expect(user.nome).toBe('Bia')
  })

  it('findVeterinarioByUser usa findFirst por userId', async () => {
    prismaMock.veterinario.findFirst.mockResolvedValueOnce({ id: 'v' })
    await expect(findVeterinarioByUser('u')).resolves.toEqual({ id: 'v' })
    expect(prismaMock.veterinario.findFirst).toHaveBeenCalledWith({ where: { userId: 'u' } })
  })
})

describe('sync de especialidades e planos', () => {
  it('especialidades: remove as que saíram e cria as novas (deduplicadas)', async () => {
    prismaMock.tx.especialidadeRelacionamento.findMany.mockResolvedValueOnce([{ especialidadeId: 'e1' }, { especialidadeId: 'e2' }])
    await syncEspecialidadesVeterinario('vet-1', ['e2', 'e3', 'e3', 4])
    expect(prismaMock.tx.especialidadeRelacionamento.findMany).toHaveBeenCalledWith({
      where: { entidadeId: 'vet-1', entidadeTipo: 'veterinario' },
    })
    expect(prismaMock.tx.especialidadeRelacionamento.deleteMany).toHaveBeenCalledWith({
      where: { entidadeId: 'vet-1', entidadeTipo: 'veterinario', especialidadeId: { in: ['e1'] } },
    })
    expect(prismaMock.tx.especialidadeRelacionamento.createMany).toHaveBeenCalledWith({
      data: [
        { entidadeId: 'vet-1', especialidadeId: 'e3', entidadeTipo: 'veterinario' },
        { entidadeId: 'vet-1', especialidadeId: '4', entidadeTipo: 'veterinario' },
      ],
    })
  })

  it('especialidades iguais: nada a gravar', async () => {
    prismaMock.tx.especialidadeRelacionamento.findMany.mockResolvedValueOnce([{ especialidadeId: 'e1' }])
    await syncEspecialidadesVeterinario('vet-1', ['e1'])
    expect(prismaMock.tx.especialidadeRelacionamento.deleteMany).not.toHaveBeenCalled()
    expect(prismaMock.tx.especialidadeRelacionamento.createMany).not.toHaveBeenCalled()
  })

  it('planos: remove e adiciona conforme a lista', async () => {
    prismaMock.tx.veterinarioPlano.findMany.mockResolvedValueOnce([{ planoId: 'p1' }])
    await syncPlanosVeterinario('vet-1', ['p2'])
    expect(prismaMock.tx.veterinarioPlano.deleteMany).toHaveBeenCalledWith({ where: { veterinarioId: 'vet-1', planoId: { in: ['p1'] } } })
    expect(prismaMock.tx.veterinarioPlano.createMany).toHaveBeenCalledWith({ data: [{ veterinarioId: 'vet-1', planoId: 'p2' }] })
  })

  it('planos iguais: nada a gravar', async () => {
    prismaMock.tx.veterinarioPlano.findMany.mockResolvedValueOnce([{ planoId: 'p1' }])
    await syncPlanosVeterinario('vet-1', ['p1'])
    expect(prismaMock.tx.veterinarioPlano.deleteMany).not.toHaveBeenCalled()
    expect(prismaMock.tx.veterinarioPlano.createMany).not.toHaveBeenCalled()
  })
})

describe('replaceExperiencias', () => {
  it.each([[undefined], [null], ['x'], [[]]])('entrada %j: só apaga as antigas', async (entrada) => {
    await replaceExperiencias('vet-1', entrada)
    expect(prismaMock.experienciaVeterinario.deleteMany).toHaveBeenCalledWith({ where: { veterinarioId: 'vet-1' } })
    expect(prismaMock.$transaction).not.toHaveBeenCalled()
  })

  it('recria as experiências convertendo colunas, datas e tinyint', async () => {
    prismaMock.experienciaVeterinario.create.mockImplementation(({ data }) => data)
    await replaceExperiencias('vet-1', [
      { local: 'Hosp', cargo: 'Vet', data_inicio: '2020-01-02', data_fim: null, descricao: 'd', ativo: true },
      null,
    ])
    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1)
    const [primeira, segunda] = prismaMock.experienciaVeterinario.create.mock.calls.map((c) => c[0].data)
    expect(primeira).toMatchObject({
      veterinarioId: 'vet-1',
      local: 'Hosp',
      cargo: 'Vet',
      dataInicio: new Date(Date.UTC(2020, 0, 2)),
      dataFim: null,
      descricao: 'd',
      ativo: 1,
    })
    expect(typeof primeira.id).toBe('string')
    expect(segunda).toMatchObject({ veterinarioId: 'vet-1', dataInicio: undefined, ativo: undefined })
  })

  it('experiência com campo desconhecido falha', async () => {
    await expect(replaceExperiencias('vet-1', [{ empresa: 'X' }])).rejects.toThrow('ExperienciaVeterinario')
  })
})

describe('findEnderecoPrincipalOuAtivo', () => {
  it('prefere o primário', async () => {
    prismaMock.veterinarioEndereco.findFirst.mockResolvedValueOnce({ id: 'prim' })
    await expect(findEnderecoPrincipalOuAtivo('vet-1')).resolves.toEqual({ id: 'prim' })
    expect(prismaMock.veterinarioEndereco.findFirst).toHaveBeenCalledTimes(1)
    expect(prismaMock.veterinarioEndereco.findFirst).toHaveBeenCalledWith({ where: { veterinarioId: 'vet-1', isPrimary: 1 } })
  })

  it('sem primário cai para qualquer ativo', async () => {
    prismaMock.veterinarioEndereco.findFirst.mockResolvedValueOnce(null).mockResolvedValueOnce({ id: 'ativo' })
    await expect(findEnderecoPrincipalOuAtivo('vet-1')).resolves.toEqual({ id: 'ativo' })
    expect(prismaMock.veterinarioEndereco.findFirst).toHaveBeenLastCalledWith({ where: { veterinarioId: 'vet-1', ativo: 1 } })
  })
})

describe('findVeterinarios', () => {
  it('sem preloads: include todo false e remove as relações do resultado', async () => {
    prismaMock.veterinario.findMany.mockResolvedValueOnce([{ id: 'v1', user: { id: 'u' }, enderecos: [], avaliacoes: [], experiencias: [] }])
    const [vet] = await findVeterinarios({ id: 'v1' }, [])
    expect(prismaMock.veterinario.findMany).toHaveBeenCalledWith({
      where: { id: 'v1' },
      include: { user: false, enderecos: false, avaliacoes: false, experiencias: false, veterinarioPlanos: false },
    })
    expect(vet).toEqual({ id: 'v1' })
    expect(prismaMock.especialidadeRelacionamento.findMany).not.toHaveBeenCalled()
  })

  it('com todos os preloads: agrupa especialidades por vet e achata planos', async () => {
    prismaMock.veterinario.findMany.mockResolvedValueOnce([
      { id: 'v1', user: undefined, veterinarioPlanos: [{ plano: { id: 'p1', name: 'Pet Love' } }] },
      { id: 'v2', user: { id: 'u2' } },
    ])
    prismaMock.especialidadeRelacionamento.findMany.mockResolvedValueOnce([
      { entidadeId: 'v1', especialidade: { id: 'e1', nome: 'Cardio' } },
      { entidadeId: 'v1', especialidade: { id: 'e2', nome: 'Derma' } },
    ])
    const [v1, v2] = await findVeterinarios({}, ['user', 'especialidades', 'enderecos', 'avaliacoes', 'experiencias', 'planos'])
    expect(prismaMock.veterinario.findMany.mock.calls[0][0].include.veterinarioPlanos).toEqual({ include: { plano: true } })
    expect(prismaMock.especialidadeRelacionamento.findMany).toHaveBeenCalledWith({
      where: { entidadeId: { in: ['v1', 'v2'] }, entidadeTipo: 'veterinario' },
      include: { especialidade: true },
    })
    expect(v1.user).toBeNull()
    expect(v1.planos).toEqual([{ id: 'p1', name: 'Pet Love' }])
    expect(v1.especialidades!.map((e) => e.nome)).toEqual(['Cardio', 'Derma'])
    expect(v1).not.toHaveProperty('veterinarioPlanos')
    expect(v2.user).toEqual({ id: 'u2' })
    expect(v2.planos).toEqual([])
    expect(v2.especialidades).toEqual([])
  })

  it('preload de especialidades sem resultados não consulta o pivot', async () => {
    await expect(findVeterinarios({}, ['especialidades'])).resolves.toEqual([])
    expect(prismaMock.especialidadeRelacionamento.findMany).not.toHaveBeenCalled()
  })
})

describe('registerVeterinario', () => {
  const dados = {
    email: '  Ana@Exemplo.COM ',
    password: 'senha123',
    nome: 'Ana',
    sobrenome: 'Vet',
    celular: '81999999999',
  }

  it('cria usuário e veterinário sem plano (PLANO_PADRAO.veterinario = none)', async () => {
    prismaMock.tx.user.create.mockResolvedValueOnce({ id: 'u-1' })
    await registerVeterinario({ ...dados, cpf: '12345678900', profilePicUrl: 'https://cdn/a.jpg' })

    expect(senha.hashPassword).toHaveBeenCalledWith('senha123')
    expect(prismaMock.tx.user.create.mock.calls[0][0].data).toMatchObject({
      email: 'ana@exemplo.com',
      password: 'hash-seguro',
      userType: 'veterinario',
      nome: 'Ana',
      sobrenome: 'Vet',
      celular: '81999999999',
      ativo: 1,
    })
    const vet = prismaMock.tx.veterinario.create.mock.calls[0][0].data
    expect(PLANO_PADRAO.veterinario).toBe('none')
    expect(vet).toMatchObject({
      userId: 'u-1',
      cpf: '12345678900',
      crmv: null,
      onboardingStep: 1,
      onboardingComplete: 0,
      isVerified: 0,
      atendePresencial: 0,
      atendeOnline: 0,
      atendeDomicilio: 0,
      fotoUrl: 'https://cdn/a.jpg',
      subscriptionPlanCode: 'none',
    })
  })

  it('cpf e foto vazios viram null', async () => {
    prismaMock.tx.user.create.mockResolvedValueOnce({ id: 'u-1' })
    await registerVeterinario({ ...dados, cpf: '', profilePicUrl: '' })
    expect(prismaMock.tx.veterinario.create.mock.calls[0][0].data).toMatchObject({ cpf: null, fotoUrl: null })
  })

  const p2002 = (target: unknown, message = 'Unique constraint failed') =>
    new Prisma.PrismaClientKnownRequestError(message, { code: 'P2002', clientVersion: 'test', meta: { target } })

  it('e-mail duplicado (P2002 em email) responde 422', async () => {
    prismaMock.tx.user.create.mockRejectedValueOnce(p2002(['email']))
    await expect(registerVeterinario(dados)).rejects.toMatchObject({ message: 'Email já está em uso', status: 422 })
  })

  it('P2002 sem target mas com email na mensagem também responde 422', async () => {
    prismaMock.tx.user.create.mockRejectedValueOnce(p2002(undefined, 'Unique constraint failed on users_email_key'))
    await expect(registerVeterinario(dados)).rejects.toMatchObject({ status: 422 })
  })

  it('P2002 em outra coluna vira erro genérico', async () => {
    prismaMock.tx.user.create.mockResolvedValueOnce({ id: 'u-1' })
    prismaMock.tx.veterinario.create.mockRejectedValueOnce(p2002(['cpf']))
    const erro = await registerVeterinario(dados).catch((e) => e)
    expect(erro.message).toBe('Erro ao registrar veterinário')
    expect(erro.status).toBeUndefined()
  })

  it('qualquer outro erro vira erro genérico', async () => {
    senha.hashPassword.mockRejectedValueOnce(new Error('bcrypt'))
    await expect(registerVeterinario(dados)).rejects.toThrow('Erro ao registrar veterinário')
    expect(prismaMock.$transaction).not.toHaveBeenCalled()
  })
})

describe('searchVeterinarios', () => {
  it('sem filtros: só TRUE, ordena vet_pro antes de vet_starter e não filtra por créditos', async () => {
    await expect(searchVeterinarios({})).resolves.toEqual([])
    const sql = sqlDaBusca()
    expect(sql.sql).toMatch(/WHERE TRUE\s+ORDER BY/)
    expect(sql.values).toEqual([])
    expect(sql.sql).not.toMatch(/creditos/i)
    const pro = sql.sql.indexOf("WHEN v.subscription_plan_code IN ('vet_pro', 'pro_plus') THEN 1")
    const starter = sql.sql.indexOf("WHEN v.subscription_plan_code IN ('vet_starter', 'pro') THEN 2")
    expect(pro).toBeGreaterThan(-1)
    expect(starter).toBeGreaterThan(pro)
    expect(sql.sql).toMatch(/ELSE 3\s+END ASC/)
  })

  it('monta todos os filtros com parâmetros (sem interpolar texto do usuário)', async () => {
    await searchVeterinarios({ search: 'Ana', cidade: 'Recife', estado: 'PE', especialidade: 'Cardio', plano: 'Pet Love' })
    const sql = sqlDaBusca()
    expect(sql.values).toEqual(['%Ana%', '%Ana%', '%Recife%', 'PE', '%Cardio%', '%Pet Love%'])
    expect(sql.text).toContain("CONCAT(u.nome, ' ', u.sobrenome) ILIKE $1) OR v.bio ILIKE $2")
    expect(sql.text).toContain('e.cidade ILIKE $3')
    expect(sql.text).toContain('e.estado = $4')
    expect(sql.text).toContain("er.entidade_tipo = 'veterinario' AND es.nome ILIKE $5")
    expect(sql.text).toContain('vp.veterinario_id = v.id AND p.name ILIKE $6')
    expect(sql.sql.match(/ AND EXISTS/g)?.length).toBeGreaterThanOrEqual(4)
    expect(sql.sql).not.toContain('Ana')
    expect(sql.sql).not.toMatch(/creditos/i)
  })

  it('filtro único: só a condição correspondente', async () => {
    await searchVeterinarios({ estado: 'SP' })
    const sql = sqlDaBusca()
    expect(sql.values).toEqual(['SP'])
    expect(sql.sql).not.toContain('ILIKE')
  })

  it('devolve na ordem do SQL (prioridade de plano) mesmo que o findMany venha embaralhado', async () => {
    prismaMock.$queryRaw.mockResolvedValueOnce([{ id: 'pro' }, { id: 'starter' }, { id: 'sem-plano' }])
    prismaMock.veterinario.findMany.mockResolvedValueOnce([
      { id: 'sem-plano', creditos: 0 },
      { id: 'starter', creditos: 0 },
      { id: 'pro', creditos: 0 },
    ])
    const res = await searchVeterinarios({})
    expect(res.map((v) => v.id)).toEqual(['pro', 'starter', 'sem-plano'])
    expect(prismaMock.veterinario.findMany.mock.calls[0][0].where).toEqual({ id: { in: ['pro', 'starter', 'sem-plano'] } })
    expect(res.every((v) => v.creditos === 0)).toBe(true)
  })

  it('formata o card com valores padrão quando faltam dados', async () => {
    prismaMock.$queryRaw.mockResolvedValueOnce([{ id: 'v1' }])
    prismaMock.veterinario.findMany.mockResolvedValueOnce([{ id: 'v1', user: null }])
    const [card] = await searchVeterinarios({})
    expect(card).toEqual({
      id: 'v1',
      nome: 'Nome Sobrenome',
      email: 'email@exemplo.com',
      fotoUrl: null,
      cidade: 'Cidade não informada',
      estado: 'UF',
      endereco: 'Endereço não informado',
      especialidades: [],
      crmv: 'CRMV não informado',
      bio: 'Veterinário especializado no cuidado de animais de estimação.',
      preco: 0,
      experiencias: [],
      rating: 0,
      totalReviews: 0,
      availability: {},
      clinica: null,
      creditos: 0,
      locations: [],
      atendeOnline: false,
      precoConsultaOnline: 0,
      horariosOnline: {},
      planos: [],
    })
  })
})

describe('getVeterinarioById', () => {
  const endereco = (over: Record<string, unknown>) => ({
    id: 'e',
    rua: 'Rua A',
    numero: '10',
    bairro: 'Centro',
    cidade: 'Recife',
    estado: 'PE',
    precoConsulta: 100,
    horariosDisponibilidade: { seg: ['09:00'] },
    isPrimary: 0,
    nomeClinica: 'Clínica',
    fotoUrl: null,
    ...over,
  })

  it('não encontrado: 404', async () => {
    await expect(getVeterinarioById('x')).rejects.toMatchObject({ message: 'Veterinário não encontrado', status: 404 })
    expect(assinatura.canCreateAppointment).not.toHaveBeenCalled()
  })

  it('erro inesperado vira 404 e é logado', async () => {
    prismaMock.veterinario.findMany.mockRejectedValueOnce(new Error('db caiu'))
    await expect(getVeterinarioById('x')).rejects.toMatchObject({ status: 404 })
    expect(console.error).toHaveBeenCalled()
  })

  it('perfil completo: endereço primário, rating, experiências, planos e limitReached', async () => {
    assinatura.canCreateAppointment.mockResolvedValueOnce({ allowed: false })
    prismaMock.veterinario.findMany.mockResolvedValueOnce([
      {
        id: 'vet-1',
        user: { nome: 'Ana', sobrenome: 'Vet', email: 'ana@x.com' },
        fotoUrl: 'https://cdn/a.jpg',
        crmv: '123',
        bio: 'Bio',
        creditos: 7,
        atendeOnline: 1,
        precoConsultaOnline: 80,
        horariosOnline: '{"ter":["10:00"]}',
        enderecos: [
          endereco({ id: 'e1', precoConsulta: 0, horariosDisponibilidade: 'inválido' }),
          endereco({ id: 'e2', isPrimary: 1, cidade: 'Olinda', precoConsulta: 120, horariosDisponibilidade: 42 }),
        ],
        avaliacoes: [{ estrelas: 5 }, { estrelas: 4 }, { estrelas: 4 }],
        experiencias: [{ cargo: 'Vet', local: 'Hosp', dataInicio: new Date(Date.UTC(2020, 0, 2)), dataFim: null, descricao: 'd' }],
        veterinarioPlanos: [{ plano: { id: 'p1', name: 'Pet Love', extra: 'x' } }],
      },
    ])
    prismaMock.especialidadeRelacionamento.findMany.mockResolvedValueOnce([
      { entidadeId: 'vet-1', especialidade: { nome: 'Cardio' } },
    ])

    const vet = await getVeterinarioById('vet-1')
    expect(prismaMock.veterinario.findMany.mock.calls[0][0].include).toMatchObject({
      user: true,
      enderecos: true,
      avaliacoes: true,
      experiencias: true,
    })
    expect(assinatura.canCreateAppointment).toHaveBeenCalledWith(expect.objectContaining({ id: 'vet-1' }))
    expect(vet).toMatchObject({
      nome: 'Ana Vet',
      email: 'ana@x.com',
      cidade: 'Olinda',
      endereco: 'Rua A, 10, Olinda',
      especialidades: ['Cardio'],
      crmv: '123',
      bio: 'Bio',
      preco: 120,
      rating: 4.3,
      totalReviews: 3,
      availability: 42,
      clinica: 'Clínica',
      creditos: 7,
      atendeOnline: true,
      precoConsultaOnline: 80,
      horariosOnline: { ter: ['10:00'] },
      planos: [{ id: 'p1', name: 'Pet Love' }],
      limitReached: true,
    })
    expect(vet.experiencias[0].dataInicio!.toISODate()).toBe('2020-01-02')
    expect(vet.locations).toEqual([
      expect.objectContaining({ id: 'e1', preco: 0, availability: {}, isPrimary: false }),
      expect.objectContaining({
        id: 'e2',
        fullAddress: 'Rua A, 10, Centro, Olinda - PE',
        endereco: 'Rua A, 10, Centro',
        preco: 120,
        availability: {},
        isPrimary: true,
      }),
    ])
  })

  it('só online e sem endereços: preço vem de precoConsultaOnline', async () => {
    prismaMock.veterinario.findMany.mockResolvedValueOnce([
      { id: 'v', atendeOnline: 1, precoConsultaOnline: 70, enderecos: [], horariosOnline: { seg: [] } },
    ])
    const vet = await getVeterinarioById('v')
    expect(vet.preco).toBe(70)
    expect(vet.horariosOnline).toEqual({ seg: [] })
    expect(vet.limitReached).toBe(false)
  })

  it('sem endereço primário usa o primeiro; online sem preço vira 0', async () => {
    prismaMock.veterinario.findMany.mockResolvedValueOnce([
      { id: 'v', atendeOnline: 0, enderecos: [endereco({ id: 'e1', precoConsulta: 90 })] },
    ])
    const vet = await getVeterinarioById('v')
    expect(vet.cidade).toBe('Recife')
    expect(vet.preco).toBe(90)
    expect(vet.availability).toEqual({ seg: ['09:00'] })

    prismaMock.veterinario.findMany.mockResolvedValueOnce([{ id: 'v', atendeOnline: 1, enderecos: [] }])
    expect((await getVeterinarioById('v')).preco).toBe(0)
  })
})
