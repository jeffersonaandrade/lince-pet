import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Prisma } from '@prisma/client'

const prismaMock = vi.hoisted(() => {
  const m: Record<string, any> = {
    tipoServico: { findMany: vi.fn(), findFirst: vi.fn() },
    user: { findFirst: vi.fn(), findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
    prestador: { findFirst: vi.fn(), findMany: vi.fn(), create: vi.fn(), update: vi.fn() },
    servicoOferecido: { updateMany: vi.fn(), createMany: vi.fn(), count: vi.fn(), findMany: vi.fn() },
  }
  m.$transaction = vi.fn()
  return m
})
vi.mock('@/server/db', () => ({ prisma: prismaMock }))

const hashPassword = vi.hoisted(() => vi.fn())
vi.mock('@/server/auth/password', () => ({ hashPassword }))

const canCreateAppointment = vi.hoisted(() => vi.fn())
vi.mock('@/server/services/subscription', () => ({ canCreateAppointment }))

import { HttpError } from '@/server/http'
import {
  MODALIDADES,
  ULTIMO_PASSO_ONBOARDING,
  buscarPrestadores,
  listarTiposServico,
  normalizarHorarios,
  obterPrestadorPublico,
  perfilDoPrestador,
  prestadorDoUsuario,
  registrarPrestador,
  salvarPasso1,
  salvarPasso3,
  salvarServicos,
  serializePrestadorPublico,
  serializeServico,
  serializeTipoServico,
  validarServicosDaModalidade,
} from '@/server/services/prestadores'

const erroDe = (p: Promise<unknown>) => p.then(() => null, (e) => e as HttpError)
const erroSync = (fn: () => unknown) => {
  try {
    fn()
  } catch (e) {
    return e as HttpError
  }
  return null
}

const TIPO = { id: 'ts-1', slug: 'tosador', nome: 'Banho e tosa', descricao: 'Banho', modalidade: 'duracao', ativo: 1, ordem: 1 }
const prestador = (over: Record<string, unknown> = {}) =>
  ({
    id: 'pr-1',
    userId: 'u-1',
    tipoServicoId: 'ts-1',
    onboardingStep: 1,
    onboardingComplete: 0,
    cpf: '123.456.789-00',
    cnpj: null,
    bio: null,
    fotoUrl: null,
    atendeDomicilio: 1,
    atendeLocalProprio: 0,
    raioKm: 5,
    horarios: null,
    subscriptionPlanCode: 'free',
    tipoServico: TIPO,
    ...over,
  }) as never

const REGISTRO = {
  tipo_servico: 'tosador',
  email: '  Caio@X.com ',
  password: 'senha123',
  nome: 'Caio',
  sobrenome: 'Reis',
  celular: '81999998888',
}

beforeEach(() => {
  vi.clearAllMocks()
  prismaMock.$transaction.mockImplementation((arg: unknown) =>
    typeof arg === 'function' ? (arg as (tx: unknown) => unknown)(prismaMock) : Promise.all(arg as unknown[])
  )
  prismaMock.user.update.mockImplementation((a: unknown) => ({ op: 'user.update', ...(a as object) }))
  prismaMock.prestador.update.mockImplementation((a: unknown) => ({ op: 'prestador.update', ...(a as object) }))
  prismaMock.servicoOferecido.updateMany.mockImplementation((a: unknown) => ({ op: 'updateMany', ...(a as object) }))
  prismaMock.servicoOferecido.createMany.mockImplementation((a: unknown) => ({ op: 'createMany', ...(a as object) }))
  hashPassword.mockResolvedValue('hash-seguro')
})

/* --------------------------------- catálogo -------------------------------- */

describe('catálogo de tipos de serviço', () => {
  it('lista só tipos ativos, por ordem e nome', async () => {
    prismaMock.tipoServico.findMany.mockResolvedValueOnce([TIPO])
    expect(await listarTiposServico()).toEqual([TIPO])
    expect(prismaMock.tipoServico.findMany).toHaveBeenCalledWith({
      where: { ativo: 1 },
      orderBy: [{ ordem: 'asc' }, { nome: 'asc' }],
    })
  })

  it('serializa só os campos públicos do tipo', () => {
    expect(serializeTipoServico(TIPO as never)).toEqual({
      id: 'ts-1',
      slug: 'tosador',
      nome: 'Banho e tosa',
      descricao: 'Banho',
      modalidade: 'duracao',
    })
    expect(MODALIDADES).toEqual(['duracao', 'periodo'])
  })
})

/* --------------------------------- cadastro -------------------------------- */

describe('registrarPrestador', () => {
  it('normaliza o e-mail, guarda a senha com hash e cria prestador free com onboarding pendente', async () => {
    prismaMock.tipoServico.findFirst.mockResolvedValueOnce(TIPO)
    prismaMock.user.findFirst.mockResolvedValueOnce(null)
    prismaMock.user.create.mockImplementationOnce(({ data }: { data: object }) => ({ ...data, id: 'u-novo' }))
    prismaMock.prestador.create.mockImplementationOnce(({ data }: { data: object }) => ({ ...data, id: 'pr-novo' }))

    const r = await registrarPrestador({ ...REGISTRO, cnpj: '12.345.678/0001-90' })

    expect(prismaMock.tipoServico.findFirst).toHaveBeenCalledWith({ where: { slug: 'tosador', ativo: 1 } })
    expect(prismaMock.user.findFirst).toHaveBeenCalledWith({
      where: { email: { equals: 'caio@x.com', mode: 'insensitive' } },
      select: { id: true },
    })
    expect(hashPassword).toHaveBeenCalledWith('senha123')
    expect(prismaMock.user.create.mock.calls[0][0].data).toMatchObject({
      email: 'caio@x.com',
      password: 'hash-seguro',
      userType: 'prestador',
      nome: 'Caio',
      sobrenome: 'Reis',
      celular: '81999998888',
      ativo: 1,
    })
    expect(prismaMock.prestador.create.mock.calls[0][0].data).toMatchObject({
      userId: 'u-novo',
      tipoServicoId: 'ts-1',
      cpf: null,
      cnpj: '12.345.678/0001-90',
      onboardingStep: 1,
      onboardingComplete: 0,
      subscriptionPlanCode: 'free',
    })
    expect(r.prestador).toMatchObject({ id: 'pr-novo' })
  })

  it('tipo fora do catálogo responde 422', async () => {
    prismaMock.tipoServico.findFirst.mockResolvedValueOnce(null)
    const e = await erroDe(registrarPrestador(REGISTRO))
    expect(e!.status).toBe(422)
    expect(e!.message).toBe('Tipo de serviço inválido')
    expect(prismaMock.user.findFirst).not.toHaveBeenCalled()
  })

  it('e-mail já cadastrado responde 422 sem gerar hash', async () => {
    prismaMock.tipoServico.findFirst.mockResolvedValueOnce(TIPO)
    prismaMock.user.findFirst.mockResolvedValueOnce({ id: 'u-existente' })
    const e = await erroDe(registrarPrestador(REGISTRO))
    expect(e!.status).toBe(422)
    expect(e!.message).toBe('Email já está em uso')
    expect(hashPassword).not.toHaveBeenCalled()
  })

  it('corrida no e-mail único (P2002) vira 422', async () => {
    prismaMock.tipoServico.findFirst.mockResolvedValueOnce(TIPO)
    prismaMock.user.findFirst.mockResolvedValueOnce(null)
    prismaMock.user.create.mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError('Unique constraint failed', { code: 'P2002', clientVersion: 'test' })
    )
    const e = await erroDe(registrarPrestador({ ...REGISTRO, cpf: '123.456.789-00' }))
    expect(e).toBeInstanceOf(HttpError)
    expect(e!.status).toBe(422)
    expect(e!.message).toBe('Email já está em uso')
  })

  it('outros erros do banco são repassados', async () => {
    prismaMock.tipoServico.findFirst.mockResolvedValueOnce(TIPO)
    prismaMock.user.findFirst.mockResolvedValueOnce(null)
    const falha = new Prisma.PrismaClientKnownRequestError('FK', { code: 'P2003', clientVersion: 'test' })
    prismaMock.user.create.mockRejectedValueOnce(falha)
    expect(await erroDe(registrarPrestador(REGISTRO))).toBe(falha)

    prismaMock.tipoServico.findFirst.mockResolvedValueOnce(TIPO)
    prismaMock.user.findFirst.mockResolvedValueOnce(null)
    const generico = new Error('conexão caiu')
    prismaMock.user.create.mockRejectedValueOnce(generico)
    expect(await erroDe(registrarPrestador(REGISTRO))).toBe(generico)
  })
})

/* -------------------------------- onboarding ------------------------------- */

describe('normalizarHorarios', () => {
  it('aceita dias 0..6 com abertura antes do fechamento', () => {
    expect(normalizarHorarios({ '0': ['08:00', '12:00'], '6': ['09:00', '18:00'] })).toEqual({
      '0': ['08:00', '12:00'],
      '6': ['09:00', '18:00'],
    })
  })

  it.each([
    [{ '7': ['08:00', '12:00'] }, 'Dia da semana inválido nos horários'],
    [{ seg: ['08:00', '12:00'] }, 'Dia da semana inválido nos horários'],
    [{ '1': ['12:00', '12:00'] }, 'O horário de fechamento deve ser depois da abertura'],
    [{ '1': ['18:00', '08:00'] }, 'O horário de fechamento deve ser depois da abertura'],
    [{}, 'Informe ao menos um dia de atendimento'],
  ])('grade %j é recusada com 422', (grade, mensagem) => {
    const e = erroSync(() => normalizarHorarios(grade))
    expect(e!.status).toBe(422)
    expect(e!.message).toBe(mensagem)
  })
})

describe('validarServicosDaModalidade', () => {
  it('duração obrigatória na modalidade duração', () => {
    expect(() => validarServicosDaModalidade([{ nome: 'Tosa', preco: 50, duracao_min: 60 }], 'duracao')).not.toThrow()
    const e = erroSync(() => validarServicosDaModalidade([{ nome: 'Tosa', preco: 50 }], 'duracao'))
    expect(e!.status).toBe(422)
    expect(e!.message).toBe('Informe a duração de "Tosa"')
  })

  it('duração proibida na modalidade período (preço por diária)', () => {
    expect(() => validarServicosDaModalidade([{ nome: 'Diária', preco: 80, duracao_min: null }], 'periodo')).not.toThrow()
    const e = erroSync(() => validarServicosDaModalidade([{ nome: 'Diária', preco: 80, duracao_min: 60 }], 'periodo'))
    expect(e!.message).toBe('"Diária" é cobrado por diária e não tem duração')
  })
})

describe('salvarPasso1', () => {
  const corpo = {
    cep: '50000-000',
    rua: 'Rua A',
    numero: '10',
    cidade: 'Recife',
    estado: 'pe',
    atende_domicilio: true,
    atende_local_proprio: false,
  }

  it('grava endereço normalizado e locais de atendimento numa transação, avançando o passo', async () => {
    await salvarPasso1(prestador(), { ...corpo, bairro: 'Centro', raio_km: 10 })
    const [ops] = prismaMock.$transaction.mock.calls[0]
    expect(ops).toHaveLength(2)
    const userArgs = prismaMock.user.update.mock.calls[0][0]
    expect(userArgs.where).toEqual({ id: 'u-1' })
    expect(userArgs.data).toMatchObject({ cep: '50000000', rua: 'Rua A', numero: '10', bairro: 'Centro', cidade: 'Recife', estado: 'PE' })
    const prestArgs = prismaMock.prestador.update.mock.calls[0][0]
    expect(prestArgs.where).toEqual({ id: 'pr-1' })
    expect(prestArgs.data).toMatchObject({ atendeDomicilio: 1, atendeLocalProprio: 0, raioKm: 10, onboardingStep: 2 })
  })

  it('sem bairro e raio grava null; não regride o passo de quem já está adiante', async () => {
    await salvarPasso1(prestador({ onboardingStep: 3 }), { ...corpo, atende_domicilio: false, atende_local_proprio: true })
    expect(prismaMock.user.update.mock.calls[0][0].data.bairro).toBeNull()
    expect(prismaMock.prestador.update.mock.calls[0][0].data).toMatchObject({
      atendeDomicilio: 0,
      atendeLocalProprio: 1,
      raioKm: null,
      onboardingStep: 3,
    })
  })

  it('precisa atender em pelo menos um local', async () => {
    const e = await erroDe(salvarPasso1(prestador(), { ...corpo, atende_domicilio: false }))
    expect(e!.status).toBe(422)
    expect(e!.message).toBe('Escolha atender em domicílio, em local próprio ou os dois')
    expect(prismaMock.$transaction).not.toHaveBeenCalled()
  })

  it('CEP inválido é barrado pelo validador', async () => {
    const e = await erroDe(salvarPasso1(prestador(), { ...corpo, cep: '123' }))
    expect((e as unknown as { status: number }).status).toBe(422)
    expect(prismaMock.$transaction).not.toHaveBeenCalled()
  })
})

describe('salvarServicos', () => {
  const corpo = { servicos: [{ nome: 'Banho', preco: 50, duracao_min: 60 }, { nome: 'Tosa', descricao: 'Completa', preco: 80, duracao_min: 90 }] }

  it('desativa os serviços antigos e cria os novos; no onboarding avança o passo', async () => {
    await salvarServicos(prestador(), corpo, 2)
    const [ops] = prismaMock.$transaction.mock.calls[0]
    expect(ops).toHaveLength(3)
    expect(prismaMock.servicoOferecido.updateMany.mock.calls[0][0]).toMatchObject({
      where: { prestadorId: 'pr-1', ativo: 1 },
      data: { ativo: 0 },
    })
    const criados = prismaMock.servicoOferecido.createMany.mock.calls[0][0].data
    expect(criados).toHaveLength(2)
    expect(criados[0]).toMatchObject({ prestadorId: 'pr-1', nome: 'Banho', descricao: null, preco: 50, duracaoMin: 60, ativo: 1 })
    expect(criados[1]).toMatchObject({ descricao: 'Completa', duracaoMin: 90 })
    expect(criados[0].id).not.toBe(criados[1].id)
    expect(prismaMock.prestador.update.mock.calls[0][0]).toMatchObject({ where: { id: 'pr-1' }, data: { onboardingStep: 3 } })
  })

  it('fora do onboarding (sem passo) não mexe no passo; hospedagem grava duração null', async () => {
    const hosp = prestador({ tipoServico: { ...TIPO, modalidade: 'periodo' } })
    await salvarServicos(hosp, { servicos: [{ nome: 'Diária', preco: 80 }] })
    const [ops] = prismaMock.$transaction.mock.calls[0]
    expect(ops).toHaveLength(2)
    expect(prismaMock.prestador.update).not.toHaveBeenCalled()
    expect(prismaMock.servicoOferecido.createMany.mock.calls[0][0].data[0].duracaoMin).toBeNull()
  })

  it('serviço incompatível com a modalidade não grava nada', async () => {
    const e = await erroDe(salvarServicos(prestador(), { servicos: [{ nome: 'Banho', preco: 50 }] }, 2))
    expect(e!.status).toBe(422)
    expect(prismaMock.$transaction).not.toHaveBeenCalled()
  })
})

describe('salvarPasso3', () => {
  const corpo = { bio: 'Tosador com 10 anos de experiência.', horarios: { '1': ['08:00', '18:00'] } }

  it('conclui o onboarding com bio, grade e foto', async () => {
    prismaMock.servicoOferecido.count.mockResolvedValueOnce(2)
    prismaMock.user.findUnique.mockResolvedValueOnce({ cidade: 'Recife' })
    await salvarPasso3(prestador(), corpo, 'https://cdn/foto.png')
    expect(prismaMock.servicoOferecido.count).toHaveBeenCalledWith({ where: { prestadorId: 'pr-1', ativo: 1 } })
    expect(prismaMock.user.findUnique).toHaveBeenCalledWith({ where: { id: 'u-1' }, select: { cidade: true } })
    const args = prismaMock.prestador.update.mock.calls[0][0]
    expect(args.where).toEqual({ id: 'pr-1' })
    expect(args.data).toMatchObject({
      bio: corpo.bio,
      horarios: { '1': ['08:00', '18:00'] },
      fotoUrl: 'https://cdn/foto.png',
      onboardingStep: ULTIMO_PASSO_ONBOARDING + 1,
      onboardingComplete: 1,
    })
  })

  it('sem foto não sobrescreve a foto atual', async () => {
    prismaMock.servicoOferecido.count.mockResolvedValueOnce(1)
    prismaMock.user.findUnique.mockResolvedValueOnce({ cidade: 'Recife' })
    await salvarPasso3(prestador(), corpo, null)
    expect(prismaMock.prestador.update.mock.calls[0][0].data).not.toHaveProperty('fotoUrl')
  })

  it('exige ao menos um serviço cadastrado', async () => {
    prismaMock.servicoOferecido.count.mockResolvedValueOnce(0)
    const e = await erroDe(salvarPasso3(prestador(), corpo))
    expect(e!.message).toBe('Cadastre ao menos um serviço antes de concluir')
    expect(prismaMock.prestador.update).not.toHaveBeenCalled()
  })

  it('exige endereço (cidade) preenchido', async () => {
    prismaMock.servicoOferecido.count.mockResolvedValueOnce(1).mockResolvedValueOnce(1)
    prismaMock.user.findUnique.mockResolvedValueOnce({ cidade: null }).mockResolvedValueOnce(null)
    expect((await erroDe(salvarPasso3(prestador(), corpo)))!.message).toBe('Preencha o endereço de atendimento antes de concluir')
    expect((await erroDe(salvarPasso3(prestador(), corpo)))!.message).toBe('Preencha o endereço de atendimento antes de concluir')
    expect(prismaMock.prestador.update).not.toHaveBeenCalled()
  })

  it('grade inválida é recusada antes de consultar o banco', async () => {
    const e = await erroDe(salvarPasso3(prestador(), { ...corpo, horarios: { '1': ['18:00', '08:00'] } }))
    expect(e!.status).toBe(422)
    expect(prismaMock.servicoOferecido.count).not.toHaveBeenCalled()
  })
})

/* ------------------------------ perfil público ----------------------------- */

const publico = (over: Record<string, unknown> = {}) =>
  ({
    ...(prestador() as object),
    bio: 'Tosador experiente',
    horarios: { '1': ['08:00', '18:00'] },
    user: {
      nome: 'Bia',
      sobrenome: 'Souza',
      profilePic: 'perfil.png',
      cidade: 'Recife',
      estado: 'PE',
      bairro: 'Boa Viagem',
      email: 'bia@x.com',
      celular: '81988887777',
      rua: 'Rua secreta',
      numero: '99',
    },
    servicos: [
      { id: 's1', nome: 'Banho', descricao: null, preco: '45.5', duracaoMin: 60 },
      { id: 's2', nome: 'Tosa', descricao: 'Completa', preco: '80', duracaoMin: 90 },
    ],
    avaliacoes: [{ estrelas: 5 }, { estrelas: 4 }, { estrelas: 4 }],
    ...over,
  }) as never

describe('serializePrestadorPublico', () => {
  it('expõe só dados públicos, preço mínimo e média das avaliações', () => {
    const r = serializePrestadorPublico(publico())
    expect(r).toEqual({
      id: 'pr-1',
      nome: 'Bia Souza',
      foto_url: 'perfil.png',
      bio: 'Tosador experiente',
      tipo_servico: serializeTipoServico(TIPO as never),
      cidade: 'Recife',
      estado: 'PE',
      bairro: 'Boa Viagem',
      atende_domicilio: true,
      atende_local_proprio: false,
      raio_km: 5,
      horarios: { '1': ['08:00', '18:00'] },
      servicos: [
        { id: 's1', nome: 'Banho', descricao: null, preco: 45.5, duracao_min: 60 },
        { id: 's2', nome: 'Tosa', descricao: 'Completa', preco: 80, duracao_min: 90 },
      ],
      preco_a_partir: 45.5,
      nota_media: 4.3,
      total_avaliacoes: 3,
    })
    const texto = JSON.stringify(r)
    expect(texto).not.toMatch(/bia@x\.com|81988887777|Rua secreta|123\.456/)
  })

  it('sem serviços, avaliações, grade nem foto', () => {
    const r = serializePrestadorPublico(
      publico({ servicos: [], avaliacoes: [], horarios: null, fotoUrl: null, user: { nome: 'Bia', sobrenome: 'Souza', profilePic: null } })
    )
    expect(r).toMatchObject({ foto_url: null, horarios: {}, servicos: [], preco_a_partir: null, nota_media: null, total_avaliacoes: 0 })
  })

  it('foto do prestador tem prioridade sobre a foto do perfil', () => {
    expect(serializePrestadorPublico(publico({ fotoUrl: 'prest.png' })).foto_url).toBe('prest.png')
  })

  it('serializeServico converte preço decimal em número', () => {
    expect(serializeServico({ id: 's', nome: 'X', descricao: 'd', preco: new Prisma.Decimal('12.30'), duracaoMin: null } as never)).toEqual({
      id: 's',
      nome: 'X',
      descricao: 'd',
      preco: 12.3,
      duracao_min: null,
    })
  })
})

describe('buscarPrestadores', () => {
  it('sem filtros: só onboarding concluído, conta ativa e tipo ativo', async () => {
    prismaMock.prestador.findMany.mockResolvedValueOnce([publico()])
    const r = await buscarPrestadores({})
    const args = prismaMock.prestador.findMany.mock.calls[0][0]
    expect(args.where).toEqual({ onboardingComplete: 1, user: { ativo: 1 }, tipoServico: { ativo: 1 } })
    expect(args.orderBy).toEqual({ createdAt: 'desc' })
    expect(args.include).toMatchObject({ servicos: { where: { ativo: 1 }, orderBy: { preco: 'asc' } } })
    expect(r).toHaveLength(1)
    expect(r[0].nome).toBe('Bia Souza')
  })

  it('com todos os filtros: tipo, cidade, UF em maiúsculas e busca textual', async () => {
    prismaMock.prestador.findMany.mockResolvedValueOnce([])
    await buscarPrestadores({ tipo: 'passeador', cidade: 'reci', estado: 'pe', search: 'bia' })
    expect(prismaMock.prestador.findMany.mock.calls[0][0].where).toEqual({
      onboardingComplete: 1,
      user: { ativo: 1, cidade: { contains: 'reci', mode: 'insensitive' }, estado: 'PE' },
      tipoServico: { ativo: 1, slug: 'passeador' },
      OR: [
        { bio: { contains: 'bia', mode: 'insensitive' } },
        { user: { nome: { contains: 'bia', mode: 'insensitive' } } },
        { user: { sobrenome: { contains: 'bia', mode: 'insensitive' } } },
      ],
    })
  })
})

describe('obterPrestadorPublico', () => {
  it('inexistente ou com onboarding pendente responde 404', async () => {
    prismaMock.prestador.findFirst.mockResolvedValueOnce(null)
    const e = await erroDe(obterPrestadorPublico('pr-x'))
    expect(e!.status).toBe(404)
    expect(e!.message).toBe('Profissional não encontrado')
    expect(prismaMock.prestador.findFirst.mock.calls[0][0].where).toEqual({ id: 'pr-x', onboardingComplete: 1, user: { ativo: 1 } })
    expect(canCreateAppointment).not.toHaveBeenCalled()
  })

  it('informa se o profissional atingiu o limite de pedidos do plano', async () => {
    prismaMock.prestador.findFirst.mockResolvedValue(publico())
    canCreateAppointment.mockResolvedValueOnce({ allowed: true }).mockResolvedValueOnce({ allowed: false })
    expect((await obterPrestadorPublico('pr-1')).limite_atingido).toBe(false)
    const r = await obterPrestadorPublico('pr-1')
    expect(r.limite_atingido).toBe(true)
    expect(r.nome).toBe('Bia Souza')
    expect(canCreateAppointment).toHaveBeenCalledWith(expect.objectContaining({ id: 'pr-1' }), 'prestador')
  })
})

/* --------------------------------- painel ---------------------------------- */

describe('perfilDoPrestador', () => {
  it('monta o perfil com endereço do usuário e serviços ativos', async () => {
    prismaMock.user.findUnique.mockResolvedValueOnce({ cep: '50000000', rua: 'Rua A', numero: '10', bairro: null, cidade: 'Recife', estado: 'PE' })
    prismaMock.servicoOferecido.findMany.mockResolvedValueOnce([{ id: 's1', nome: 'Banho', descricao: null, preco: '50', duracaoMin: 60 }])
    const r = await perfilDoPrestador(prestador({ onboardingComplete: 1, horarios: { '1': ['08:00', '18:00'] } }))
    expect(prismaMock.servicoOferecido.findMany).toHaveBeenCalledWith({ where: { prestadorId: 'pr-1', ativo: 1 }, orderBy: { preco: 'asc' } })
    expect(r).toEqual({
      id: 'pr-1',
      tipo_servico: serializeTipoServico(TIPO as never),
      onboarding_step: 1,
      onboarding_complete: true,
      cpf: '123.456.789-00',
      cnpj: null,
      bio: null,
      foto_url: null,
      atende_domicilio: true,
      atende_local_proprio: false,
      raio_km: 5,
      horarios: { '1': ['08:00', '18:00'] },
      subscription_plan_code: 'free',
      endereco: { cep: '50000000', rua: 'Rua A', numero: '10', bairro: null, cidade: 'Recife', estado: 'PE' },
      servicos: [{ id: 's1', nome: 'Banho', descricao: null, preco: 50, duracao_min: 60 }],
    })
  })

  it('sem usuário encontrado o endereço vem todo nulo', async () => {
    prismaMock.user.findUnique.mockResolvedValueOnce(null)
    prismaMock.servicoOferecido.findMany.mockResolvedValueOnce([])
    const r = await perfilDoPrestador(prestador())
    expect(r.endereco).toEqual({ cep: null, rua: null, numero: null, bairro: null, cidade: null, estado: null })
    expect(r.horarios).toEqual({})
    expect(r.onboarding_complete).toBe(false)
  })
})

describe('prestadorDoUsuario', () => {
  it('retorna o prestador com o tipo; sem prestador responde 404', async () => {
    prismaMock.prestador.findFirst.mockResolvedValueOnce({ id: 'pr-1' }).mockResolvedValueOnce(null)
    expect(await prestadorDoUsuario('u-1')).toEqual({ id: 'pr-1' })
    expect(prismaMock.prestador.findFirst).toHaveBeenCalledWith({ where: { userId: 'u-1' }, include: { tipoServico: true } })
    const e = await erroDe(prestadorDoUsuario('u-2'))
    expect(e!.status).toBe(404)
    expect(e!.message).toBe('Prestador não encontrado')
  })
})
