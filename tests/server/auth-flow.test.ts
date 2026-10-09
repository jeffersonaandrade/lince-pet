import { describe, it, expect } from 'vitest'
import { NextResponse } from 'next/server'
import {
  GOOGLE_SCOPES,
  GOOGLE_STATE_COOKIE,
  buildAuthorizeUrl,
  callbackError,
  clearStateCookie,
  createState,
  setStateCookie,
} from '@/server/auth/google'
import { clearAuthCookie, setAuthCookie } from '@/server/auth/session'
import { forgotPasswordEmail } from '@/server/emails/forgot_password'

const qs = (s: string) => new URLSearchParams(s)

describe('Google OAuth (equivalente ao ally)', () => {
  it('gera states aleatórios de 32 caracteres', () => {
    const a = createState()
    expect(a).toHaveLength(32)
    expect(a).not.toBe(createState())
  })

  it('monta a URL de autorização com os escopos padrão do ally', () => {
    const url = new URL(buildAuthorizeUrl({ clientId: 'cid', redirectUri: 'http://x/api/auth/google/callback', state: 'st' }))
    expect(url.origin + url.pathname).toBe('https://accounts.google.com/o/oauth2/v2/auth')
    expect(url.searchParams.get('client_id')).toBe('cid')
    expect(url.searchParams.get('redirect_uri')).toBe('http://x/api/auth/google/callback')
    expect(url.searchParams.get('response_type')).toBe('code')
    expect(url.searchParams.get('scope')).toBe(GOOGLE_SCOPES.join(' '))
    expect(url.searchParams.get('state')).toBe('st')
  })

  it('classifica erros do callback na mesma ordem do controller', () => {
    expect(callbackError(qs('error=access_denied&state=x'), null)).toBe('access_denied')
    expect(callbackError(qs('code=c&state=x'), null)).toBe('state_mismatch')
    expect(callbackError(qs('code=c&state=x'), 'y')).toBe('state_mismatch')
    expect(callbackError(qs('error=server_error&state=x'), 'x')).toBe('server_error')
    expect(callbackError(qs('state=x'), 'x')).toBe('unknown_error')
    expect(callbackError(qs('code=c&state=x'), 'x')).toBeNull()
  })

  it('define e limpa o cookie de state', () => {
    const res = NextResponse.json({})
    setStateCookie(res, 'st')
    const cookie = res.cookies.get(GOOGLE_STATE_COOKIE)!
    expect(cookie).toMatchObject({ value: 'st', httpOnly: true, sameSite: 'lax', path: '/api/auth/google' })
    clearStateCookie(res)
    expect(res.cookies.get(GOOGLE_STATE_COOKIE)).toMatchObject({ value: '', maxAge: 0 })
  })
})

describe('Cookie de autenticação', () => {
  it('define auth_token httpOnly por 30 dias e limpa no logout', () => {
    const res = NextResponse.json({})
    setAuthCookie(res, 'jwt')
    expect(res.cookies.get('auth_token')).toMatchObject({
      value: 'jwt',
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 30 * 24 * 60 * 60,
    })
    clearAuthCookie(res)
    expect(res.cookies.get('auth_token')).toMatchObject({ value: '', maxAge: 0 })
  })
})

describe('E-mail de recuperação de senha', () => {
  it('escapa as interpolações', () => {
    const html = forgotPasswordEmail({ url: 'http://x/reset-password?token=a&b', nome: '<b>Ana</b>' })
    expect(html).toContain('Olá, &lt;b&gt;Ana&lt;/b&gt;')
    expect(html).toContain('href="http://x/reset-password?token=a&amp;b"')
  })
})
