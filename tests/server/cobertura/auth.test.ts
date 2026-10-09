import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const mocks = vi.hoisted(() => ({
  prisma: {
    tutor: { findFirst: vi.fn() },
    veterinario: { findFirst: vi.fn() },
    clinica: { findFirst: vi.fn() },
    prestador: { findFirst: vi.fn() },
    user: { findFirst: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
    passwordResetToken: { deleteMany: vi.fn(), create: vi.fn(), findUnique: vi.fn(), delete: vi.fn() },
  },
  generateToken: vi.fn(async () => 'jwt-falso'),
  hashPassword: vi.fn(async (s: string) => `hash(${s})`),
  verifyPassword: vi.fn(),
  sendMail: vi.fn(),
  forgotPasswordEmail: vi.fn(({ url, nome }: { url: string; nome: string }) => `<p>${nome} ${url}</p>`),
}))

vi.mock('@/server/db', () => ({ prisma: mocks.prisma }))
vi.mock('@/server/auth/jwt', () => ({ generateToken: mocks.generateToken }))
vi.mock('@/server/auth/password', () => ({ hashPassword: mocks.hashPassword, verifyPassword: mocks.verifyPassword }))
vi.mock('@/server/services/mail', () => ({ sendMail: mocks.sendMail, defaultFrom: () => 'nao-responda@teste.dev' }))
vi.mock('@/server/emails/forgot_password', () => ({ forgotPasswordEmail: mocks.forgotPasswordEmail }))

import { HttpError } from '@/server/http'
import {
  findEntityId,
  tokenFor,
  login,
  getUserProfile,
  forgotPassword,
  resetPassword,
} from '@/server/services/auth'

const { prisma } = mocks

const usuarioBanco = {
  id: 'user-1',
  email: 'Ana@Exemplo.com',
  password: '$scrypt$hash-secreto',
  nome: 'Ana',
  sobrenome: 'Lima',
  userType: 'tutor',
}

const baseUser = {
  id: 'user-1',
  email: 'ana@exemplo.com',
  userType: 'tutor',
  nome: 'Ana',
  sobrenome: 'Lima',
  celular: '81999999999',
  cidade: 'Recife',
  estado: 'PE',
  createdAt: new Date('2026-01-01T00:00:00Z'),
  profilePic: null as string | null,
  googleCalendarAuthorized: 0 as number | null,
}

beforeEach(() => vi.clearAllMocks())
afterEach(() => vi.unstubAllEnvs())

describe('findEntityId', () => {
  it.each([
    ['tutor', 'tutor'],
    ['veterinario', 'veterinario'],
    ['clinica', 'clinica'],
    ['prestador', 'prestador'],
  ] as const)('busca o id da entidade %s pelo userId', async (userType, model) => {
    prisma[model].findFirst.mockResolvedValueOnce({ id: `${model}-9` })
    await expect(findEntityId('user-1', userType)).resolves.toBe(`${model}-9`)
    expect(prisma[model].findFirst).toHaveBeenCalledWith({ where: { userId: 'user-1' }, select: { id: true } })
  })

  it('devolve undefined quando a entidade não existe', async () => {
    prisma.tutor.findFirst.mockResolvedValueOnce(null)
    await expect(findEntityId('user-1', 'tutor')).resolves.toBeUndefined()
  })

  it('devolve undefined para tipo sem entidade (ex.: admin) sem consultar o banco', async () => {
    await expect(findEntityId('user-1', 'admin')).resolves.toBeUndefined()
    for (const m of ['tutor', 'veterinario', 'clinica', 'prestador'] as const) {
      expect(prisma[m].findFirst).not.toHaveBeenCalled()
    }
  })
})

describe('tokenFor', () => {
  it('gera o token com o entityId da entidade do usuário', async () => {
    prisma.veterinario.findFirst.mockResolvedValueOnce({ id: 'vet-7' })
    const token = await tokenFor({ id: 'user-2', nome: 'Bia', sobrenome: null, userType: 'veterinario' })
    expect(token).toBe('jwt-falso')
    expect(mocks.generateToken).toHaveBeenCalledWith({
      id: 'user-2',
      nome: 'Bia',
      sobrenome: null,
      userType: 'veterinario',
      entityId: 'vet-7',
    })
  })
})

describe('login', () => {
  it('compara o e-mail sem diferenciar maiúsculas e não expõe a senha', async () => {
    prisma.user.findFirst.mockResolvedValueOnce({ ...usuarioBanco })
    mocks.verifyPassword.mockResolvedValueOnce(true)
    prisma.tutor.findFirst.mockResolvedValueOnce({ id: 'tutor-1' })

    const res = await login('ANA@exemplo.com', 'Senha@123')

    expect(prisma.user.findFirst).toHaveBeenCalledWith({
      where: { email: { equals: 'ANA@exemplo.com', mode: 'insensitive' } },
      omit: { password: false },
    })
    expect(mocks.verifyPassword).toHaveBeenCalledWith(usuarioBanco.password, 'Senha@123')
    expect(res).toEqual({
      message: 'Login realizado com sucesso',
      user: { id: 'user-1', email: 'Ana@Exemplo.com', userType: 'tutor', nome: 'Ana' },
      token: 'jwt-falso',
    })
    expect(JSON.stringify(res)).not.toContain('scrypt')
    expect(mocks.generateToken).toHaveBeenCalledWith(expect.objectContaining({ entityId: 'tutor-1' }))
  })

  it('usuário inexistente: calcula hash mesmo assim (tempo constante) e responde 400', async () => {
    prisma.user.findFirst.mockResolvedValueOnce(null)
    const erro = await login('x@y.com', 'qualquer').catch((e) => e)
    expect(erro).toBeInstanceOf(HttpError)
    expect(erro.status).toBe(400)
    expect(erro.body).toEqual({ status: 400, message: 'Invalid user credentials' })
    expect(mocks.hashPassword).toHaveBeenCalledWith('qualquer')
    expect(mocks.verifyPassword).not.toHaveBeenCalled()
    expect(mocks.generateToken).not.toHaveBeenCalled()
  })

  it('senha errada responde 400 com a mesma mensagem e não gera token', async () => {
    prisma.user.findFirst.mockResolvedValueOnce({ ...usuarioBanco })
    mocks.verifyPassword.mockResolvedValueOnce(false)
    const erro = await login('ana@exemplo.com', 'errada').catch((e) => e)
    expect(erro).toBeInstanceOf(HttpError)
    expect(erro.status).toBe(400)
    expect(erro.message).toBe('Invalid user credentials')
    expect(mocks.generateToken).not.toHaveBeenCalled()
  })
})

describe('getUserProfile', () => {
  it('perfil base: foto nula e googleCalendarAuthorized booleano', () => {
    const perfil = getUserProfile({ ...baseUser, userType: 'admin' } as never)
    expect(perfil).toEqual({
      id: 'user-1',
      email: 'ana@exemplo.com',
      userType: 'admin',
      nome: 'Ana',
      sobrenome: 'Lima',
      celular: '81999999999',
      cidade: 'Recife',
      estado: 'PE',
      createdAt: baseUser.createdAt,
      fotoUrl: null,
      googleCalendarAuthorized: false,
    })
  })

  it('tutor sem registro de tutor carregado devolve só o perfil base', () => {
    const perfil = getUserProfile({ ...baseUser, profilePic: 'p.jpg', googleCalendarAuthorized: 1, tutor: null } as never)
    expect(perfil).not.toHaveProperty('cpf')
    expect(perfil.fotoUrl).toBe('p.jpg')
    expect(perfil.googleCalendarAuthorized).toBe(true)
  })

  it('tutor inclui o CPF', () => {
    const perfil = getUserProfile({ ...baseUser, tutor: { cpf: '12345678900' } } as never)
    expect(perfil).toMatchObject({ userType: 'tutor', cpf: '12345678900' })
  })

  it('veterinário: dados profissionais e padrões para créditos, plano e uso mensal', () => {
    const vet = {
      cpf: '1',
      cnpj: null,
      crmv: 'PE-123',
      bio: 'Bio',
      fotoUrl: null,
      atendePresencial: 1,
      atendeOnline: 0,
      atendeDomicilio: 0,
      precoConsulta: 150,
      creditos: null,
      onboardingComplete: 1,
      subscriptionPlanCode: '',
      monthlyAppointmentsUsed: null,
    }
    const perfil = getUserProfile({ ...baseUser, userType: 'veterinario', profilePic: 'user.jpg', veterinario: vet } as never)
    expect(perfil).toMatchObject({
      crmv: 'PE-123',
      fotoUrl: 'user.jpg',
      creditos: 0,
      subscriptionPlanCode: null,
      monthlyAppointmentsUsed: 0,
      onboardingComplete: 1,
    })
  })

  it('veterinário: foto do vet tem prioridade e mantém plano e uso', () => {
    const vet = { fotoUrl: 'vet.jpg', creditos: 3, subscriptionPlanCode: 'vet_pro', monthlyAppointmentsUsed: 4 }
    const perfil = getUserProfile({ ...baseUser, userType: 'veterinario', profilePic: 'user.jpg', veterinario: vet } as never)
    expect(perfil).toMatchObject({ fotoUrl: 'vet.jpg', creditos: 3, subscriptionPlanCode: 'vet_pro', monthlyAppointmentsUsed: 4 })
  })

  it('clínica: dados da clínica e foto de perfil com fallback', () => {
    const clinica = {
      nomeClinica: 'Clínica X',
      tipoClinica: 'multipla',
      cnpj: '00',
      descricao: 'd',
      horariosFuncionamento: null,
      quantidadeVets: '1',
      onboardingComplete: 0,
      isVerified: 0,
      fotoPerfil: null,
    }
    const semFoto = getUserProfile({ ...baseUser, userType: 'clinica', profilePic: 'u.jpg', clinica } as never)
    expect(semFoto).toMatchObject({ nomeClinica: 'Clínica X', isVerified: 0, fotoUrl: 'u.jpg' })
    const comFoto = getUserProfile({ ...baseUser, userType: 'clinica', clinica: { ...clinica, fotoPerfil: 'c.jpg' } } as never)
    expect(comFoto.fotoUrl).toBe('c.jpg')
  })

  it('prestador: tipo de serviço resumido e plano nulo quando vazio', () => {
    const prestador = {
      cpf: '1',
      cnpj: null,
      bio: 'b',
      fotoUrl: null,
      tipoServico: { id: 't1', slug: 'tosador', nome: 'Tosador', modalidade: 'presencial', extra: 'x' },
      onboardingComplete: 0,
      onboardingStep: 2,
      subscriptionPlanCode: null,
    }
    const perfil = getUserProfile({ ...baseUser, userType: 'prestador', prestador } as never)
    expect(perfil).toMatchObject({
      tipoServico: { slug: 'tosador', nome: 'Tosador', modalidade: 'presencial' },
      onboardingStep: 2,
      subscriptionPlanCode: null,
      fotoUrl: null,
    })
    expect((perfil as { tipoServico: object }).tipoServico).not.toHaveProperty('extra')

    const comFoto = getUserProfile({
      ...baseUser,
      userType: 'prestador',
      prestador: { ...prestador, fotoUrl: 'pr.jpg', subscriptionPlanCode: 'pro' },
    } as never)
    expect(comFoto).toMatchObject({ fotoUrl: 'pr.jpg', subscriptionPlanCode: 'pro' })
  })
})

describe('forgotPassword', () => {
  it('e-mail desconhecido: mesma mensagem genérica, sem token nem e-mail', async () => {
    prisma.user.findFirst.mockResolvedValueOnce(null)
    const res = await forgotPassword('ninguem@x.com')
    expect(res).toEqual({ message: 'um link de recuperação foi enviado para sua caixa de Email.' })
    expect(prisma.user.findFirst).toHaveBeenCalledWith({
      where: { email: { equals: 'ninguem@x.com', mode: 'insensitive' } },
    })
    expect(prisma.passwordResetToken.create).not.toHaveBeenCalled()
    expect(mocks.sendMail).not.toHaveBeenCalled()
  })

  it('apaga tokens antigos, cria token de 1h e envia o link pela URL do app', async () => {
    vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://app.teste')
    prisma.user.findFirst.mockResolvedValueOnce({ id: 'user-1', email: 'ana@exemplo.com', nome: 'Ana' })

    const res = await forgotPassword('ANA@exemplo.com')

    expect(res.message).toBe('um link de recuperação foi enviado para sua caixa de Email.')
    expect(prisma.passwordResetToken.deleteMany).toHaveBeenCalledWith({ where: { userId: 'user-1' } })
    const data = prisma.passwordResetToken.create.mock.calls[0][0].data
    expect(data.token).toMatch(/^[0-9a-f]{64}$/)
    expect(data.expiresAt.getTime() - data.createdAt.getTime()).toBe(60 * 60 * 1000)
    expect(mocks.sendMail).toHaveBeenCalledWith({
      from: 'nao-responda@teste.dev',
      to: 'ana@exemplo.com',
      subject: 'Redefinição de Senha - Lince-Pet',
      html: `<p>Ana https://app.teste/reset-password?token=${data.token}</p>`,
    })
  })

  it('sem NEXT_PUBLIC_APP_URL usa localhost:3000', async () => {
    vi.stubEnv('NEXT_PUBLIC_APP_URL', '')
    prisma.user.findFirst.mockResolvedValueOnce({ id: 'user-1', email: 'a@b.c', nome: 'A' })
    await forgotPassword('a@b.c')
    expect(mocks.forgotPasswordEmail.mock.calls[0][0].url).toMatch(/^http:\/\/localhost:3000\/reset-password\?token=/)
  })
})

describe('resetPassword', () => {
  const futuro = () => new Date(Date.now() + 60_000)

  it('token inexistente: erro de token inválido', async () => {
    prisma.passwordResetToken.findUnique.mockResolvedValueOnce(null)
    await expect(resetPassword('tok', 'nova')).rejects.toThrow('Token inválido ou expirado.')
    expect(prisma.user.update).not.toHaveBeenCalled()
  })

  it('token expirado é apagado e rejeitado', async () => {
    prisma.passwordResetToken.findUnique.mockResolvedValueOnce({ id: 'rt-1', userId: 'user-1', expiresAt: new Date(Date.now() - 1000) })
    await expect(resetPassword('tok', 'nova')).rejects.toThrow('Token inválido ou expirado.')
    expect(prisma.passwordResetToken.delete).toHaveBeenCalledWith({ where: { id: 'rt-1' } })
    expect(prisma.user.update).not.toHaveBeenCalled()
  })

  it('token sem usuário: "Usuário não encontrado."', async () => {
    prisma.passwordResetToken.findUnique.mockResolvedValueOnce({ id: 'rt-1', userId: null, expiresAt: futuro() })
    await expect(resetPassword('tok', 'nova')).rejects.toThrow('Usuário não encontrado.')
    expect(prisma.user.findUnique).not.toHaveBeenCalled()
  })

  it('usuário apagado: "Usuário não encontrado."', async () => {
    prisma.passwordResetToken.findUnique.mockResolvedValueOnce({ id: 'rt-1', userId: 'user-1', expiresAt: futuro() })
    prisma.user.findUnique.mockResolvedValueOnce(null)
    await expect(resetPassword('tok', 'nova')).rejects.toThrow('Usuário não encontrado.')
  })

  it('grava a nova senha com hash e consome o token', async () => {
    prisma.passwordResetToken.findUnique.mockResolvedValueOnce({ id: 'rt-1', userId: 'user-1', expiresAt: futuro() })
    prisma.user.findUnique.mockResolvedValueOnce({ id: 'user-1' })

    const res = await resetPassword('tok', 'NovaSenha@1')

    expect(res).toEqual({ message: 'Senha redefinida com sucesso!' })
    expect(prisma.passwordResetToken.findUnique).toHaveBeenCalledWith({ where: { token: 'tok' } })
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: { password: 'hash(NovaSenha@1)', updatedAt: expect.any(Date) },
    })
    expect(prisma.passwordResetToken.delete).toHaveBeenCalledWith({ where: { id: 'rt-1' } })
  })
})
