import 'server-only'
import type { NextResponse } from 'next/server'
import type { Clinica, Prestador, TipoServico, Tutor, User, Veterinario } from '@/generated/prisma/client'
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
  if (header?.startsWith('Bearer ')) return header.slice(7) || null
  // Token na URL ou no corpo vaza em logs e histórico; só cookie ou header.
  return null
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

const sessaoRevogada = async (jti: string | undefined) =>
  !!jti && !!(await prisma.sessaoRevogada.findUnique({ where: { jti }, select: { jti: true } }))

/** Token válido, não encerrado no logout e da versão atual do usuário (redefinir senha sobe a versão). */
async function sessaoDoToken(token: string) {
  const decoded = await verifyToken(token)
  if (!decoded) return { erro: 'Token inválido' as const }
  const [user, revogada] = await Promise.all([loadUser(String(decoded.userId)), sessaoRevogada(decoded.jti)])
  if (!user) return { erro: 'Usuário não encontrado' as const }
  if (user.redefinicaoSenhaObrigatoria) return { erro: 'Redefina a senha da conta recuperada antes de acessar.' as const }
  if (revogada || (decoded.tv ?? 0) !== (user.tokenVersion ?? 0)) return { erro: 'Sessão encerrada' as const }
  return { user, decoded }
}

/** Equivalente ao jwt_auth_middleware (mesmas mensagens e status). */
export async function authenticate(req: ApiRequest): Promise<CurrentUser> {
  const token = extractToken(req)
  if (!token) throw new HttpError(401, { message: 'Token de autenticação não encontrado' })

  const sessao = await sessaoDoToken(token)
  if ('erro' in sessao) throw new HttpError(401, { message: sessao.erro }, { clearAuthCookie: true })
  return sessao.user
}

/** Encerra só a sessão deste token (outras sessões do usuário continuam). Token inválido: nada a fazer. */
export async function revogarSessao(token: string | null) {
  const decoded = token ? await verifyToken(token) : null
  if (!decoded?.jti || !decoded.exp) return
  const agora = new Date()
  await prisma.$transaction([
    prisma.sessaoRevogada.deleteMany({ where: { expiraEm: { lt: agora } } }),
    prisma.sessaoRevogada.upsert({
      where: { jti: decoded.jti },
      create: { jti: decoded.jti, expiraEm: new Date(decoded.exp * 1000) },
      update: {},
    }),
  ])
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

/** Conta de clínica logada, com o registro da clínica. */
export async function requireClinica(req: ApiRequest): Promise<Clinica> {
  const user = await requireUser(req, ['clinica'])
  if (!user.clinica) throw new HttpError(404, { message: 'Clínica não encontrada' })
  return user.clinica
}

/** Conta de tutor logada, com o registro do tutor. */
export async function requireTutor(req: ApiRequest): Promise<Tutor> {
  const user = await requireUser(req, ['tutor'])
  if (!user.tutor) throw new HttpError(400, { message: 'Apenas tutores podem agendar exames' })
  return user.tutor
}

/** Admin da Lince (`users.is_admin`), de qualquer tipo de conta. */
export async function requireAdmin(req: ApiRequest): Promise<CurrentUser> {
  const user = await authenticate(req)
  if (user.isAdmin !== 1) throw new HttpError(403, { message: 'Acesso restrito ao administrador da Lince Pet.' })
  return user
}

/** Usuário opcional (rotas públicas que se comportam diferente quando logado). */
export async function optionalUser(req: ApiRequest) {
  const token = extractToken(req)
  if (!token) return null
  const sessao = await sessaoDoToken(token)
  return 'erro' in sessao ? null : sessao.user
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
