import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { SignJWT } from 'jose'

const prismaMock = vi.hoisted(() => ({
  user: { findUnique: vi.fn() },
  tutor: { findFirst: vi.fn() },
  veterinario: { findFirst: vi.fn() },
  prestador: { findFirst: vi.fn() },
  clinica: { findFirst: vi.fn() },
  sessaoRevogada: { findUnique: vi.fn(), deleteMany: vi.fn(), upsert: vi.fn() },
  $transaction: vi.fn(async (ops: unknown[]) => ops),
}))
vi.mock('@/server/db', () => ({ prisma: prismaMock }))

import { ApiRequest } from '@/server/http'
import { authenticate, revogarSessao } from '@/server/auth/session'
import { TOKEN_MAX_AGE_SECONDS, appKey, generateToken, verifyToken } from '@/server/auth/jwt'
import { CALENDAR_STATE_TYPE } from '@/server/services/google-calendar'

const USER_ID = '11111111-2222-4333-8444-555555555555'
const usuario = (tokenVersion: number) => ({ id: USER_ID, userType: 'tutor', tokenVersion })
const dadosToken = (tokenVersion: number) => ({
  id: USER_ID,
  nome: 'Ana',
  sobrenome: null,
  userType: 'tutor' as const,
  entityId: 1,
  tokenVersion,
})

const comToken = (token: string) =>
  ApiRequest.from(new NextRequest('http://x/api/me', { headers: { authorization: `Bearer ${token}` } }))

beforeAll(() => {
  process.env.APP_KEY = 'test-app-key-with-enough-length-1234'
})

beforeEach(() => {
  vi.clearAllMocks()
  prismaMock.tutor.findFirst.mockResolvedValue({ id: 1 })
  prismaMock.sessaoRevogada.findUnique.mockResolvedValue(null)
  prismaMock.veterinario.findFirst.mockResolvedValue(null)
  prismaMock.prestador.findFirst.mockResolvedValue(null)
  prismaMock.clinica.findFirst.mockResolvedValue(null)
})

describe('Sessão revogável', () => {
  it('permite atuar como tutor sem carregar o perfil profissional da mesma conta', async () => {
    prismaMock.user.findUnique.mockResolvedValue({ ...usuario(0), userType: 'veterinario' })
    const token = await generateToken(dadosToken(0))
    const user = await authenticate(await comToken(token))
    expect(user.userType).toBe('tutor')
    expect(user.tutor).toBeTruthy()
    expect(user.veterinario).toBeNull()
  })
  it('recusa token que seleciona perfil não pertencente à conta', async () => {
    prismaMock.user.findUnique.mockResolvedValue(usuario(0))
    const token = await generateToken({ ...dadosToken(0), userType: 'veterinario' })
    await expect(authenticate(await comToken(token))).rejects.toMatchObject({ status: 401 })
  })
  it('clínica não alterna para um perfil individual, mesmo com vínculo legado', async () => {
    prismaMock.user.findUnique.mockResolvedValue({ ...usuario(0), userType: 'clinica' })
    const token = await generateToken(dadosToken(0))
    await expect(authenticate(await comToken(token))).rejects.toMatchObject({ status: 401 })
  })
  it('token novo dura 7 dias e carrega jti e versão', async () => {
    const token = await generateToken(dadosToken(2))
    const decoded = (await verifyToken(token))!
    expect(decoded.tv).toBe(2)
    expect(decoded.jti).toMatch(/^[0-9a-f-]{36}$/)
    expect(decoded.exp! - Math.floor(Date.now() / 1000)).toBeLessThanOrEqual(TOKEN_MAX_AGE_SECONDS)
  })

  it('aceita a versão atual e recusa token anterior à redefinição de senha', async () => {
    const token = await generateToken(dadosToken(0))
    prismaMock.user.findUnique.mockResolvedValue(usuario(0))
    await expect(authenticate(await comToken(token))).resolves.toMatchObject({ id: USER_ID })

    prismaMock.user.findUnique.mockResolvedValue(usuario(1))
    await expect(authenticate(await comToken(token))).rejects.toMatchObject({
      status: 401,
      body: { message: 'Sessão encerrada' },
    })
  })

  it('recusa token encerrado no logout', async () => {
    const token = await generateToken(dadosToken(0))
    prismaMock.user.findUnique.mockResolvedValue(usuario(0))
    prismaMock.sessaoRevogada.findUnique.mockResolvedValue({ jti: 'x' })
    await expect(authenticate(await comToken(token))).rejects.toMatchObject({ status: 401 })
  })

  it('logout grava o jti até o fim da validade e limpa os vencidos', async () => {
    const token = await generateToken(dadosToken(0))
    const { jti, exp } = (await verifyToken(token))!
    await revogarSessao(token)
    expect(prismaMock.sessaoRevogada.deleteMany).toHaveBeenCalled()
    expect(prismaMock.sessaoRevogada.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ create: { jti, expiraEm: new Date(exp! * 1000) } })
    )
  })

  it('logout com token inválido não grava nada', async () => {
    await revogarSessao('lixo')
    await revogarSessao(null)
    expect(prismaMock.$transaction).not.toHaveBeenCalled()
  })

  it('state do Google Agenda não vale como sessão', async () => {
    const state = await new SignJWT({ userId: USER_ID, userType: 'tutor' })
      .setProtectedHeader({ alg: 'HS256', typ: CALENDAR_STATE_TYPE })
      .setExpirationTime('10m')
      .sign(appKey())
    expect(await verifyToken(state)).toBeNull()
  })
})
