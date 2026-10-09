import { NextResponse } from 'next/server'
import { ApiRequest, route, serverError } from '@/server/http'
import { requireUser } from '@/server/auth/session'
import { googleCalendar } from '@/server/services/google-calendar'

export const GET = route(async (req) => {
  const request = await ApiRequest.from(req)
  const user = await requireUser(request)
  try {
    const redirectTo = request.input<string>('redirect_to') || '/explorar'
    return NextResponse.redirect(await googleCalendar.getAuthUrl(user.id, redirectTo))
  } catch (error) {
    console.error('[Google Calendar] Erro no redirecionamento para o Google:', error)
    return serverError({ message: 'Erro interno ao iniciar autorização com o Google.' })
  }
})
