import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Prisma } from '@prisma/client'

const mocks = vi.hoisted(() => {
  const prisma = {
    user: { create: vi.fn() },
    tutor: { create: vi.fn() },
    $transaction: vi.fn(),
  }
  prisma.$transaction.mockImplementation(async (fn: (tx: typeof prisma) => unknown) => fn(prisma))
  return { prisma, hashPassword: vi.fn(async (s: string) => `hash(${s})`) }
})

vi.mock('@/server/db', () => ({ prisma: mocks.prisma }))
vi.mock('@/server/auth/password', () => ({ hashPassword: mocks.hashPassword }))

import { HttpError } from '@/server/http'
import { registerTutor } from '@/server/services/tutor'

const { prisma } = mocks

const p2002 = (target: unknown, message = 'Unique constraint failed') =>
  new Prisma.PrismaClientKnownRequestError(message, {
    code: 'P2002',
    clientVersion: '6.0.0',
    meta: target === undefined ? undefined : { target },
  })

beforeEach(() => {
  vi.clearAllMocks()
  vi.spyOn(console, 'log').mockImplementation(() => {})
})

describe('registerTutor', () => {
  it('cria user tutor (e-mail em minúsculas, senha com hash) e o registro de tutor na mesma transação', async () => {
    prisma.user.create.mockResolvedValueOnce({ id: 'user-1' })
    prisma.tutor.create.mockResolvedValueOnce({ id: 'tutor-1', userId: 'user-1' })

    const res = await registerTutor({ nome: 'Ana', email: '  Ana@Exemplo.COM ', password: 'Senha@123', cidade: 'Recife' })

    expect(res).toEqual({ id: 'tutor-1', userId: 'user-1' })
    expect(prisma.$transaction).toHaveBeenCalledTimes(1)
    const userData = prisma.user.create.mock.calls[0][0].data
    expect(userData).toMatchObject({
      email: 'ana@exemplo.com',
      password: 'hash(Senha@123)',
      userType: 'tutor',
      nome: 'Ana',
      celular: null,
      cep: null,
      cidade: 'Recife',
      estado: null,
      ativo: 1,
      id: expect.any(String),
      createdAt: expect.any(Date),
    })
    expect(userData.password).not.toBe('Senha@123')
    expect(prisma.tutor.create.mock.calls[0][0].data).toMatchObject({ userId: 'user-1', cpf: null })
  })

  it('cidade ausente vira null', async () => {
    prisma.user.create.mockResolvedValueOnce({ id: 'user-1' })
    prisma.tutor.create.mockResolvedValueOnce({ id: 'tutor-1' })
    await registerTutor({ nome: 'Ana', email: 'a@b.c', password: 'x' })
    expect(prisma.user.create.mock.calls[0][0].data.cidade).toBeNull()
  })

  it('e-mail duplicado (P2002 no target email): 422 "Email já está em uso"', async () => {
    prisma.user.create.mockRejectedValueOnce(p2002(['email']))
    const erro = await registerTutor({ nome: 'Ana', email: 'a@b.c', password: 'x' }).catch((e) => e)
    expect(erro).toBeInstanceOf(HttpError)
    expect(erro.status).toBe(422)
    expect(erro.body).toEqual({ status: 422, message: 'Email já está em uso' })
    expect(prisma.tutor.create).not.toHaveBeenCalled()
  })

  it('P2002 sem meta mas com "email" na mensagem também é e-mail duplicado', async () => {
    prisma.user.create.mockRejectedValueOnce(p2002(undefined, 'Unique constraint failed on users_email_unique'))
    const erro = await registerTutor({ nome: 'Ana', email: 'a@b.c', password: 'x' }).catch((e) => e)
    expect(erro.body).toEqual({ status: 422, message: 'Email já está em uso' })
  })

  it('outro campo duplicado: 422 "Dados duplicados encontrados"', async () => {
    prisma.tutor.create.mockRejectedValueOnce(p2002(['cpf']))
    prisma.user.create.mockResolvedValueOnce({ id: 'user-1' })
    const erro = await registerTutor({ nome: 'Ana', email: 'a@b.c', password: 'x' }).catch((e) => e)
    expect(erro).toBeInstanceOf(HttpError)
    expect(erro.status).toBe(422)
    expect(erro.message).toBe('Dados duplicados encontrados')
  })

  it('outros erros do Prisma viram erro genérico (sem vazar detalhes)', async () => {
    prisma.user.create.mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError('fk', { code: 'P2003', clientVersion: '6.0.0' })
    )
    const erro = await registerTutor({ nome: 'Ana', email: 'a@b.c', password: 'x' }).catch((e) => e)
    expect(erro).not.toBeInstanceOf(HttpError)
    expect(erro.message).toBe('Erro ao registrar tutor')
  })

  it('falha no hash também vira erro genérico e nada é gravado', async () => {
    mocks.hashPassword.mockRejectedValueOnce(new Error('scrypt falhou'))
    await expect(registerTutor({ nome: 'Ana', email: 'a@b.c', password: 'x' })).rejects.toThrow('Erro ao registrar tutor')
    expect(prisma.$transaction).not.toHaveBeenCalled()
  })
})
