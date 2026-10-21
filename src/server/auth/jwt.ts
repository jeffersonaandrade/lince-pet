import 'server-only'
import { randomUUID } from 'node:crypto'
import { SignJWT, jwtVerify } from 'jose'
import { requiredEnv } from '../env'

export type UserType = 'tutor' | 'veterinario' | 'clinica' | 'prestador'

export type TokenPayload = {
  userId: number | string
  entityId?: number | string
  nome: string
  sobrenome: string | null
  userType: UserType
  /** Versão do token do usuário (`users.token_version`); token antigo sem `tv` conta como 0. */
  tv?: number
  jti?: string
  exp?: number
}

export const AUTH_COOKIE = 'auth_token'
export const TOKEN_MAX_AGE_SECONDS = 7 * 24 * 60 * 60
/** Distingue o JWT de sessão de outros JWTs assinados com a mesma APP_KEY (ex.: state do Google Agenda). */
export const SESSION_TOKEN_TYPE = 'JWT'

/** APP_KEY é o mesmo segredo HS256 usado pelo jsonwebtoken no Adonis. */
export const appKey = () => new TextEncoder().encode(requiredEnv('APP_KEY'))

export async function generateToken(user: {
  id: number | string
  nome: string
  sobrenome: string | null
  userType: UserType
  entityId?: number | string
  tokenVersion?: number
}) {
  const payload: Record<string, unknown> = {
    userId: user.id,
    nome: user.nome,
    sobrenome: user.sobrenome,
    userType: user.userType,
    tv: user.tokenVersion ?? 0,
  }
  if (user.entityId !== undefined) payload.entityId = user.entityId

  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256', typ: SESSION_TOKEN_TYPE })
    .setJti(randomUUID())
    .setIssuedAt()
    .setExpirationTime(`${TOKEN_MAX_AGE_SECONDS}s`)
    .sign(appKey())
}

export async function verifyToken(token: string): Promise<TokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, appKey(), { algorithms: ['HS256'], typ: SESSION_TOKEN_TYPE })
    return payload as unknown as TokenPayload
  } catch {
    return null
  }
}
