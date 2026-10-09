import 'server-only'
import type { NextResponse } from 'next/server'
import type { Clinica, Prestador, TipoServico, Tutor, User, Veterinario } from '@prisma/client'
import { prisma } from '../db'
import { HttpError, type ApiRequest } from '../http'
import { isProduction } from '../env'
import { AUTH_COOKIE, TOKEN_MAX_AGE_SECONDS, verifyToken, type UserType } from './jwt'

export type PublicUser = Omit<User, 'password' | 'googleAccessToken' | 'googleRefreshToken' | 'googleTokenExpiresAt'>

export type CurrentUser = PublicUser & {
  userType: UserType
  tutor: Tutor | null
  veterinario: Veterinario | null
  clinica: Clinica | null
  prestador?: (Prestador & { tipoServico: TipoServico }) | null
}

/**
 * Cookie emitido pelo Adonis é assinado ("s:<base64url(json)>.<hmac>").
 * Extraímos o JWT de dentro; a validade é garantida pela assinatura do próprio JWT.
 */
function tokenFromCookie(value: string | null) {
  if (!value) return null
  if (!value.startsWith('s:')) return value
  try {
    const payload = value.slice(2).split('.')[0]
    const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'))
    return typeof decoded?.message === 'string' ? decoded.message : null
  } catch {
    return null
  }
}

export function extractToken(req: ApiRequest) {
  const fromCookie = tokenFromCookie(req.cookie(AUTH_COOKIE))
  if (fromCookie) return fromCookie
  const header = req.header('authorization')
  if (header?.startsWith('Bearer ')) return header.slice(7)
  return (req.input('token') as string | undefined) || null
}

/** Carrega o usuário com o perfil do seu tipo (equivalente ao preload do Lucid). */
export async function loadUser(userId: string): Promise<CurrentUser | null> {
  const user = await prisma.user.findUnique({ where: { id: userId } })
  if (!user) return null
  const userType = user.userType as UserType
  const where = { userId: user.id }
  const [tutor, veterinario, clinica, prestador] = await Promise.all([
    userType === 'tutor' ? prisma.tutor.findFirst({ where }) : null,
    userType === 'veterinario' ? prisma.veterinario.findFirst({ where }) : null,
    userType === 'clinica' ? prisma.clinica.findFirst({ where }) : null,
    userType === 'prestador' ? prisma.prestador.findFirst({ where, include: { tipoServico: true } }) : null,
  ])
  return { ...user, userType, tutor, veterinario, clinica, prestador }
}

/** Equivalente ao jwt_auth_middleware (mesmas mensagens e status). */
export async function authenticate(req: ApiRequest): Promise<CurrentUser> {
  const token = extractToken(req)
  if (!token) throw new HttpError(401, { message: 'Token de autenticação não encontrado' })

  const decoded = await verifyToken(token)
  if (!decoded) throw new HttpError(401, { message: 'Token inválido' }, { clearAuthCookie: true })

  const user = await loadUser(String(decoded.userId))
  if (!user) throw new HttpError(401, { message: 'Usuário não encontrado' }, { clearAuthCookie: true })
  return user
}

/** jwt_auth_middleware + user_type_middleware. */
export async function requireUser(req: ApiRequest, allowed?: UserType[]): Promise<CurrentUser> {
  const user = await authenticate(req)
  if (!allowed) return user

  const valid: UserType[] = ['clinica', 'tutor', 'veterinario', 'prestador']
  if (!valid.includes(user.userType)) {
    throw new HttpError(400, { message: `Tipo de usuário inválido: '${user.userType}'.` })
  }
  if (!allowed.includes(user.userType)) {
    throw new HttpError(403, { message: `Acesso negado. Tipo de usuário '${user.userType}' não autorizado.` })
  }
  return user
}

/** Usuário opcional (rotas públicas que se comportam diferente quando logado). */
export async function optionalUser(req: ApiRequest) {
  const token = extractToken(req)
  if (!token) return null
  const decoded = await verifyToken(token)
  return decoded ? loadUser(String(decoded.userId)) : null
}

export function setAuthCookie(res: NextResponse, token: string) {
  res.cookies.set(AUTH_COOKIE, token, {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax',
    path: '/',
    maxAge: TOKEN_MAX_AGE_SECONDS,
  })
}

export function clearAuthCookie(res: NextResponse) {
  res.cookies.set(AUTH_COOKIE, '', { httpOnly: true, path: '/', maxAge: 0 })
}

/** Remove campos com serializeAs: null no model User do Lucid. */
export function serializeUser(user: Partial<User>): PublicUser {
  const { password, googleAccessToken, googleRefreshToken, googleTokenExpiresAt, ...rest } = user
  void password
  void googleAccessToken
  void googleRefreshToken
  void googleTokenExpiresAt
  return rest as PublicUser
}
