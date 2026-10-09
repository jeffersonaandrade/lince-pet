import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Prisma } from '@prisma/client'

const mocks = vi.hoisted(() => {
  const prisma = {
    user: { create: vi.fn(), update: vi.fn() },
    clinica: { create: vi.fn(), update: vi.fn() },
    especialidadeRelacionamento: { findMany: vi.fn(), deleteMany: vi.fn(), createMany: vi.fn() },
    clinicaPlano: { findMany: vi.fn(), deleteMany: vi.fn(), createMany: vi.fn() },
    $transaction: vi.fn(),
  }
  prisma.$transaction.mockImplementation(async (fn: (tx: typeof prisma) => unknown) => fn(prisma))
  return { prisma, hashPassword: vi.fn(async (s: string) => `hash(${s})`) }
})

vi.mock('@/server/db', () => ({ prisma: mocks.prisma }))
vi.mock('@/server/auth/password', () => ({ hashPassword: mocks.hashPassword }))

import { PLANO_PADRAO } from '@/server/services/assinante'
import {
  serializeClinica,
  serializeEndereco,
  serializeRelatedUser,
  especialidadesPorEntidade,
  mediaAvaliacoes,
  mysqlDateTime,
  formatDataConsulta,
  toJsonColumn,
  str,
  dirtyFields,
  saveClinica,
  saveUser,
  syncEspecialidadesClinica,
  syncPlanosClinica,
  registerClinica,
} from '@/server/services/clinicas'

const { prisma } = mocks

const p2002 = (target: unknown, message = 'Unique constraint failed') =>
  new Prisma.PrismaClientKnownRequestError(message, {
    code: 'P2002',
    clientVersion: '6.0.0',
    meta: target === undefined ? undefined : { target },
  })

beforeEach(() => {
  vi.clearAllMocks()
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

describe('serializadores', () => {
  it('serializeClinica remove nomeFantasia (coluna fora do model)', () => {
    expect(serializeClinica({ id: 'c1', nomeClinica: 'X', nomeFantasia: 'Y' })).toEqual({ id: 'c1', nomeClinica: 'X' })
  })

  it('serializeEndereco remove horariosDisponibilidadeColuna', () => {
    expect(serializeEndereco({ id: 'e1', rua: 'R', horariosDisponibilidadeColuna: '{}' } as never)).toEqual({ id: 'e1', rua: 'R' })
  })

  it('serializeRelatedUser esconde senha e tokens Google; nulo vira null', () => {
    const user = serializeRelatedUser({
      id: 'u1',
      nome: 'Ana',
      password: 'segredo',
      googleAccessToken: 'a',
      googleRefreshToken: 'r',
      googleTokenExpiresAt: new Date(),
    } as never)
    expect(user).toEqual({ id: 'u1', nome: 'Ana' })
    expect(serializeRelatedUser(null)).toBeNull()
    expect(serializeRelatedUser(undefined)).toBeNull()
  })
})

describe('especialidadesPorEntidade', () => {
  it('lista vazia não consulta o banco', async () => {
    const map = await especialidadesPorEntidade([], 'clinica')
    expect(map.size).toBe(0)
    expect(prisma.especialidadeRelacionamento.findMany).not.toHaveBeenCalled()
  })

  it('agrupa especialidades por entidade', async () => {
    prisma.especialidadeRelacionamento.findMany.mockResolvedValueOnce([
      { entidadeId: 'c1', especialidade: { id: 'e1' } },
      { entidadeId: 'c2', especialidade: { id: 'e2' } },
      { entidadeId: 'c1', especialidade: { id: 'e3' } },
    ])
    const map = await especialidadesPorEntidade(['c1', 'c2'], 'veterinario')
    expect(prisma.especialidadeRelacionamento.findMany).toHaveBeenCalledWith({
      where: { entidadeId: { in: ['c1', 'c2'] }, entidadeTipo: 'veterinario' },
      include: { especialidade: true },
    })
    expect(map.get('c1')).toEqual([{ id: 'e1' }, { id: 'e3' }])
    expect(map.get('c2')).toEqual([{ id: 'e2' }])
  })
})

describe('utilitários', () => {
  it('mediaAvaliacoes: 1 casa decimal e total', () => {
    expect(mediaAvaliacoes([5, 4, 4])).toEqual({ rating: 4.3, totalReviews: 3 })
    expect(mediaAvaliacoes([])).toEqual({ rating: 0, totalReviews: 0 })
  })

  it('mysqlDateTime formata no fuso local com milissegundos', () => {
    expect(mysqlDateTime(new Date(2026, 0, 5, 3, 4, 5, 7))).toBe('2026-01-05 03:04:05.007')
  })

  it('formatDataConsulta: data SQL vira YYYY-MM-DD; null vira "null"', () => {
    expect(formatDataConsulta('2026-01-05 10:00:00')).toBe('2026-01-05')
    expect(formatDataConsulta(null)).toBe('null')
  })

  it('toJsonColumn: string é parseada; null vira JsonNull', () => {
    expect(toJsonColumn('{"a":1}')).toEqual({ a: 1 })
    expect(toJsonColumn({ b: 2 })).toEqual({ b: 2 })
    expect(toJsonColumn(null)).toBe(Prisma.JsonNull)
    expect(toJsonColumn('null')).toBe(Prisma.JsonNull)
  })

  it('str preserva null/undefined e converte o resto para string', () => {
    expect(str(null)).toBeNull()
    expect(str(undefined)).toBeUndefined()
    expect(str(123)).toBe('123')
  })

  it('dirtyFields devolve só o que mudou', () => {
    expect(dirtyFields({ a: 1, b: 'x' }, { a: 1, b: 'y', c: null })).toEqual({ b: 'y', c: null })
  })
})

describe('saveClinica / saveUser', () => {
  it('saveClinica sem mudanças não grava', async () => {
    await saveClinica({ id: 'c1', descricao: 'd' } as never, { descricao: 'd' })
    expect(prisma.clinica.update).not.toHaveBeenCalled()
  })

  it('saveClinica grava só os campos alterados, com updatedAt, e atualiza o objeto', async () => {
    const clinica = { id: 'c1', descricao: 'd', cidade: 'Recife' }
    await saveClinica(clinica as never, { descricao: 'nova', cidade: 'Recife' })
    expect(prisma.clinica.update).toHaveBeenCalledWith({
      where: { id: 'c1' },
      data: { descricao: 'nova', updatedAt: expect.any(Date) },
    })
    expect(clinica.descricao).toBe('nova')
  })

  it('saveUser sem mudanças não grava; com mudança grava e atualiza', async () => {
    const user = { id: 'u1', nome: 'Ana' }
    await saveUser(user, { nome: 'Ana' })
    expect(prisma.user.update).not.toHaveBeenCalled()
    await saveUser(user, { nome: 'Bia' })
    expect(prisma.user.update).toHaveBeenCalledWith({ where: { id: 'u1' }, data: { nome: 'Bia', updatedAt: expect.any(Date) } })
    expect(user.nome).toBe('Bia')
  })
})

describe('syncEspecialidadesClinica', () => {
  it('remove as que saíram e adiciona as novas (ids deduplicados como string)', async () => {
    prisma.especialidadeRelacionamento.findMany.mockResolvedValueOnce([{ especialidadeId: '1' }, { especialidadeId: '2' }])
    await syncEspecialidadesClinica('c1', [2, '3', 3])
    expect(prisma.especialidadeRelacionamento.findMany).toHaveBeenCalledWith({ where: { entidadeId: 'c1', entidadeTipo: 'clinica' } })
    expect(prisma.especialidadeRelacionamento.deleteMany).toHaveBeenCalledWith({
      where: { entidadeId: 'c1', entidadeTipo: 'clinica', especialidadeId: { in: ['1'] } },
    })
    expect(prisma.especialidadeRelacionamento.createMany).toHaveBeenCalledWith({
      data: [{ entidadeId: 'c1', especialidadeId: '3', entidadeTipo: 'clinica' }],
    })
  })

  it('sem diferença não apaga nem cria', async () => {
    prisma.especialidadeRelacionamento.findMany.mockResolvedValueOnce([{ especialidadeId: '1' }])
    await syncEspecialidadesClinica('c1', ['1'])
    expect(prisma.especialidadeRelacionamento.deleteMany).not.toHaveBeenCalled()
    expect(prisma.especialidadeRelacionamento.createMany).not.toHaveBeenCalled()
  })
})

describe('syncPlanosClinica', () => {
  it('remove e adiciona planos conforme a lista', async () => {
    prisma.clinicaPlano.findMany.mockResolvedValueOnce([{ planoId: 'p1' }, { planoId: 'p2' }])
    await syncPlanosClinica('c1', ['p2', 'p3'])
    expect(prisma.clinicaPlano.deleteMany).toHaveBeenCalledWith({ where: { clinicaId: 'c1', planoId: { in: ['p1'] } } })
    expect(prisma.clinicaPlano.createMany).toHaveBeenCalledWith({ data: [{ clinicaId: 'c1', planoId: 'p3' }] })
  })

  it('sem diferença não apaga nem cria', async () => {
    prisma.clinicaPlano.findMany.mockResolvedValueOnce([{ planoId: 'p1' }])
    await syncPlanosClinica('c1', ['p1'])
    expect(prisma.clinicaPlano.deleteMany).not.toHaveBeenCalled()
    expect(prisma.clinicaPlano.createMany).not.toHaveBeenCalled()
  })
})

describe('registerClinica', () => {
  const dados = {
    nomeFantasia: 'Clínica Pet',
    razaoSocial: 'Pet LTDA',
    cnpj: '12345678000199',
    telefone: '8133334444',
    email: '  Contato@ClinicaPet.com ',
    senha: 'Senha@123',
    cep: '50000000',
    rua: 'Rua A',
    numero: '10',
    bairro: 'Centro',
    cidade: 'Recife',
    estado: 'PE',
  }

  it('cria user e clínica na transação, começando sem plano (none)', async () => {
    prisma.clinica.create.mockImplementationOnce(async ({ data }: { data: object }) => ({ ...data, nomeFantasia: 'col-extra' }))

    const { user, clinica } = await registerClinica(dados)

    expect(PLANO_PADRAO.clinica).toBe('none')
    const userData = prisma.user.create.mock.calls[0][0].data
    expect(userData).toMatchObject({
      email: 'contato@clinicapet.com',
      password: 'hash(Senha@123)',
      userType: 'clinica',
      nome: 'Clínica Pet',
      celular: '8133334444',
      cep: '50000000',
      rua: 'Rua A',
      cidade: 'Recife',
      estado: 'PE',
      ativo: 1,
    })
    const clinicaData = prisma.clinica.create.mock.calls[0][0].data
    expect(clinicaData).toMatchObject({
      userId: userData.id,
      nomeClinica: 'Clínica Pet',
      razaoSocial: 'Pet LTDA',
      tipoClinica: 'multipla',
      quantidadeVets: '1',
      cnpj: '12345678000199',
      endereco: 'Rua A, 10 - Centro',
      horariosFuncionamento: Prisma.DbNull,
      onboardingComplete: 0,
      isVerified: 0,
      subscriptionPlanCode: 'none',
    })

    expect(user).not.toHaveProperty('password')
    expect(JSON.stringify(user)).not.toContain('hash(')
    expect(user).toMatchObject({ id: userData.id, email: 'contato@clinicapet.com', ativo: true })
    expect(user.clinica).not.toHaveProperty('nomeFantasia')
    expect(user.clinica).toMatchObject({ subscriptionPlanCode: 'none' })
    expect(clinica).toMatchObject({ subscriptionPlanCode: 'none' })
  })

  it('campos opcionais ausentes viram string vazia / null e endereço vazio', async () => {
    prisma.clinica.create.mockImplementationOnce(async ({ data }: { data: object }) => data)
    await registerClinica({ nomeFantasia: 'X', cnpj: '1', email: 'a@b.c', senha: 's' })
    const userData = prisma.user.create.mock.calls[0][0].data
    expect(userData).toMatchObject({ celular: undefined, cep: '', rua: '', numero: '', bairro: '', cidade: '', estado: '' })
    const clinicaData = prisma.clinica.create.mock.calls[0][0].data
    expect(clinicaData).toMatchObject({ endereco: '', cep: '', cidade: '', estado: '', razaoSocial: undefined })
  })

  it('e-mail duplicado: 422 "Email já está em uso"', async () => {
    prisma.user.create.mockRejectedValueOnce(p2002(['email']))
    const erro = await registerClinica(dados).catch((e) => e)
    expect(erro.message).toBe('Email já está em uso')
    expect(erro.status).toBe(422)
    expect(prisma.clinica.create).not.toHaveBeenCalled()
  })

  it('CNPJ duplicado: 422 "CNPJ já está em uso"', async () => {
    prisma.clinica.create.mockRejectedValueOnce(p2002(['cnpj']))
    const erro = await registerClinica(dados).catch((e) => e)
    expect(erro).toMatchObject({ message: 'CNPJ já está em uso', status: 422 })
  })

  it('P2002 sem meta usa a mensagem do erro para identificar o campo', async () => {
    prisma.clinica.create.mockRejectedValueOnce(p2002(undefined, 'Unique constraint failed on clinicas_cnpj_key'))
    const erro = await registerClinica(dados).catch((e) => e)
    expect(erro).toMatchObject({ message: 'CNPJ já está em uso', status: 422 })
  })

  it('outro campo duplicado: 422 "Dados duplicados encontrados"', async () => {
    prisma.clinica.create.mockRejectedValueOnce(p2002(['user_id']))
    const erro = await registerClinica(dados).catch((e) => e)
    expect(erro).toMatchObject({ message: 'Dados duplicados encontrados', status: 422 })
  })

  it('demais erros: "Erro ao registrar clínica" sem status', async () => {
    prisma.user.create.mockRejectedValueOnce(new Error('conexão caiu'))
    const erro = await registerClinica(dados).catch((e) => e)
    expect(erro.message).toBe('Erro ao registrar clínica')
    expect(erro.status).toBeUndefined()
  })
})
