import 'server-only'
import { randomBytes } from 'node:crypto'
import type { NextResponse } from 'next/server'
import { env, isProduction, requiredEnv } from '../env'

/** Reimplementação do driver Google do @adonisjs/ally (authorization code + state em cookie). */

export const GOOGLE_STATE_COOKIE = 'google_oauth_state'
const STATE_COOKIE_PATH = '/api/auth/google'

const AUTHORIZE_URL = 'https://accounts.google.com/o/oauth2/v2/auth'
const TOKEN_URL = 'https://oauth2.googleapis.com/token'
const USER_INFO_URL = 'https://www.googleapis.com/oauth2/v3/userinfo'
export const GOOGLE_SCOPES = [
  'openid',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile',
]

export type GoogleUser = { id: string; name: string; email: string; avatarUrl: string | null }

export const createState = () => randomBytes(24).toString('base64url')

export const googleCallbackUrl = (origin: string) =>
  env('GOOGLE_CALLBACK_URL') || `${env('NEXT_PUBLIC_APP_URL') || origin}/api/auth/google/callback`

export const frontendBaseUrl = (origin: string) => env('FRONTEND_BASE_URL') || env('NEXT_PUBLIC_APP_URL') || origin

export function buildAuthorizeUrl(opts: { clientId: string; redirectUri: string; state: string }) {
  const url = new URL(AUTHORIZE_URL)
  url.searchParams.set('client_id', opts.clientId)
  url.searchParams.set('redirect_uri', opts.redirectUri)
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('scope', GOOGLE_SCOPES.join(' '))
  url.searchParams.set('state', opts.state)
  return url.toString()
}

/** Mesma ordem do controller: accessDenied → stateMisMatch → hasError. */
export function callbackError(params: URLSearchParams, cookieState: string | null) {
  const error = params.get('error')
  if (error === 'access_denied') return 'access_denied'
  if (!cookieState || cookieState !== params.get('state')) return 'state_mismatch'
  if (error) return error
  if (!params.get('code')) return 'unknown_error'
  return null
}

export function setStateCookie(res: NextResponse, state: string) {
  res.cookies.set(GOOGLE_STATE_COOKIE, state, {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax',
    path: STATE_COOKIE_PATH,
    maxAge: 10 * 60,
  })
}

export function clearStateCookie(res: NextResponse) {
  res.cookies.set(GOOGLE_STATE_COOKIE, '', { httpOnly: true, path: STATE_COOKIE_PATH, maxAge: 0 })
}

export function googleAuthorizeUrl(origin: string, state: string) {
  return buildAuthorizeUrl({
    clientId: requiredEnv('GOOGLE_CLIENT_ID'),
    redirectUri: googleCallbackUrl(origin),
    state,
  })
}

export async function fetchGoogleUser(code: string, origin: string): Promise<GoogleUser> {
  const tokenRes = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
    body: new URLSearchParams({
      client_id: requiredEnv('GOOGLE_CLIENT_ID'),
      client_secret: requiredEnv('GOOGLE_CLIENT_SECRET'),
      redirect_uri: googleCallbackUrl(origin),
      grant_type: 'authorization_code',
      code,
    }),
  })
  if (!tokenRes.ok) throw new Error(`Google token exchange failed: ${tokenRes.status} ${await tokenRes.text()}`)
  const { access_token: accessToken } = (await tokenRes.json()) as { access_token?: string }
  if (!accessToken) throw new Error('Google token exchange returned no access_token')

  const userRes = await fetch(USER_INFO_URL, {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
  })
  if (!userRes.ok) throw new Error(`Google userinfo failed: ${userRes.status}`)
  const body = (await userRes.json()) as { sub: string; name: string; email: string; picture?: string }
  return { id: body.sub, name: body.name, email: body.email, avatarUrl: body.picture ?? null }
}
