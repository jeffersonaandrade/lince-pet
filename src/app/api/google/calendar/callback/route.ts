import { NextResponse, type NextRequest } from 'next/server'
import { jwtVerify } from 'jose'
import { env, requiredEnv } from '@/server/env'
import { googleCalendar } from '@/server/services/google-calendar'

type CalendarState = { userId?: string; redirectTo?: string }

async function decodeState(state: string) {
  const key = new TextEncoder().encode(requiredEnv('APP_KEY'))
  const { payload } = await jwtVerify(state, key, { algorithms: ['HS256'] })
  return payload as CalendarState
}

const withParam = (url: string, param: string) => `${url}${url.includes('?') ? '&' : '?'}${param}`

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
          isFullUrl = true
          redirectToPath = decoded.redirectTo
          frontendBaseUrl = new URL(decoded.redirectTo).origin
        } else {
          redirectToPath = decoded.redirectTo.startsWith('/') ? decoded.redirectTo : `/${decoded.redirectTo}`
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

    await googleCalendar.exchangeCodeForTokens(code, userId)
    return NextResponse.redirect(successUrl('google_calendar=success'))
  } catch (error) {
    console.error('[Google Calendar] Erro crítico no callback do Google Calendar:', error)
    return NextResponse.redirect(errorUrl('auth_failed'))
  }
}
