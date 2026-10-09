import 'server-only'
import { SignJWT, jwtVerify } from 'jose'
import { requiredEnv } from '../env'

export type UserType = 'tutor' | 'veterinario' | 'clinica'

export type TokenPayload = {
  userId: number | string
  entityId?: number | string
  nome: string
  sobrenome: string | null
  userType: UserType
}

export const AUTH_COOKIE = 'auth_token'
export const TOKEN_MAX_AGE_SECONDS = 30 * 24 * 60 * 60

/** APP_KEY é o mesmo segredo HS256 usado pelo jsonwebtoken no Adonis. */
const secret = () => new TextEncoder().encode(requiredEnv('APP_KEY'))

export async function generateToken(user: {
  id: number | string
  nome: string
  sobrenome: string | null
  userType: UserType
  entityId?: number | string
}) {
  const payload: Record<string, unknown> = {
    userId: user.id,
    nome: user.nome,
    sobrenome: user.sobrenome,
    userType: user.userType,
  }
  if (user.entityId !== undefined) payload.entityId = user.entityId

  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setIssuedAt()
    .setExpirationTime('30d')
    .sign(secret())
}

export async function verifyToken(token: string): Promise<TokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secret(), { algorithms: ['HS256'] })
    return payload as unknown as TokenPayload
  } catch {
    return null
  }
}
