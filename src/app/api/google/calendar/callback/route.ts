import { NextResponse, type NextRequest } from 'next/server'
import { jwtVerify } from 'jose'
import { env, requiredEnv } from '@/server/env'
import { googleCalendar } from '@/server/services/google-calendar'
import { ApiRequest } from '@/server/http'
import { optionalUser } from '@/server/auth/session'

type CalendarState = { userId?: string; redirectTo?: string }

async function decodeState(state: string) {
  const key = new TextEncoder().encode(requiredEnv('APP_KEY'))
  const { payload } = await jwtVerify(state, key, { algorithms: ['HS256'] })
  return payload as CalendarState
}

const withParam = (url: string, param: string) => `${url}${url.includes('?') ? '&' : '?'}${param}`

/** Só aceita URL absoluta do próprio app; outra origem viraria redirecionamento aberto (phishing). */
function origemPermitida(url: string) {
  const permitidas = [env('FRONTEND_BASE_URL'), env('NEXT_PUBLIC_APP_URL'), 'http://localhost:3000']
    .filter((u): u is string => !!u)
    .map((u) => {
      try {
        return new URL(u).origin
      } catch {
        return null
      }
    })
  try {
    return permitidas.includes(new URL(url).origin)
  } catch {
    return false
  }
}

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams
  const code = params.get('code')
  const state = params.get('state')
  const errorParam = params.get('error')

  let frontendBaseUrl = env('FRONTEND_BASE_URL') || 'http://localhost:3000'
  let redirectToPath = '/explorar'
  let isFullUrl = false

  if (state) {
    try {
      const decoded = await decodeState(state)
      if (decoded.redirectTo) {
        if (decoded.redirectTo.startsWith('http://') || decoded.redirectTo.startsWith('https://')) {
          if (!origemPermitida(decoded.redirectTo)) throw new Error('redirectTo fora do app')
          isFullUrl = true
          redirectToPath = decoded.redirectTo
          frontendBaseUrl = new URL(decoded.redirectTo).origin
        } else {
          redirectToPath = `/${decoded.redirectTo.replace(/^[/\\]+/, '')}`
        }
      }
    } catch (err) {
      console.warn('[Google Calendar] Falha ao decodificar state prematuramente:', err)
    }
  }

  const successUrl = (param: string) => withParam(isFullUrl ? redirectToPath : `${frontendBaseUrl}${redirectToPath}`, param)
  const errorUrl = (type: string) =>
    isFullUrl
      ? withParam(redirectToPath, `google_calendar_error=${type}`)
      : `${frontendBaseUrl}/explorar?google_calendar_error=${type}`

  if (errorParam) {
    console.warn('[Google Calendar] Consentimento recusado ou erro retornado pelo Google:', errorParam)
    return NextResponse.redirect(errorUrl('access_denied'))
  }

  if (!code || !state) {
    return NextResponse.redirect(`${frontendBaseUrl}/explorar?google_calendar_error=missing_params`)
  }

  try {
    const { userId } = await decodeState(state)
    if (!userId) throw new Error('UserId ausente no state JWT.')

    // O state é assinado mas não prova quem está no navegador: sem isto, a agenda de outra pessoa ficaria na conta do atacante.
    const sessao = await optionalUser(await ApiRequest.from(req)).catch(() => null)
    if (sessao?.id !== userId) {
      console.warn('[Google Calendar] Sessão do navegador não corresponde ao state.')
      return NextResponse.redirect(errorUrl('session_mismatch'))
    }

    await googleCalendar.exchangeCodeForTokens(code, userId)
    return NextResponse.redirect(successUrl('google_calendar=success'))
  } catch (error) {
    console.error('[Google Calendar] Erro crítico no callback do Google Calendar:', error)
    return NextResponse.redirect(errorUrl('auth_failed'))
  }
}
