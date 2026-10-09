import { ApiRequest, ok, route, serverError } from '@/server/http'
import { requireUser } from '@/server/auth/session'
import { googleCalendar } from '@/server/services/google-calendar'

/** POST /google/calendar/disconnect: para de criar eventos; não apaga consultas nem eventos já criados. */
export const POST = route(async (req) => {
  const user = await requireUser(await ApiRequest.from(req))
  try {
    await googleCalendar.desconectar(user.id)
    return ok({ message: 'Google Calendar desconectado com sucesso.' })
  } catch (error) {
    console.error('[Google Calendar] Erro ao desconectar:', error)
    return serverError({ message: 'Erro interno ao desconectar o Google Calendar.' })
  }
})
