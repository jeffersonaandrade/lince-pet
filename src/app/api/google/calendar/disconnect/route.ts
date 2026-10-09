import { prisma } from '@/server/db'
import { ApiRequest, ok, route, serverError } from '@/server/http'
import { requireUser } from '@/server/auth/session'
import { updating } from '@/server/lucid'

export const POST = route(async (req) => {
  const user = await requireUser(await ApiRequest.from(req))
  try {
    await prisma.user.update({
      where: { id: user.id },
      data: updating({
        googleCalendarAuthorized: 0,
        googleAccessToken: null,
        googleRefreshToken: null,
        googleTokenExpiresAt: null,
      }),
    })
    return ok({ message: 'Google Calendar desconectado com sucesso.' })
  } catch (error) {
    console.error('[Google Calendar] Erro ao desconectar:', error)
    return serverError({ message: 'Erro interno ao desconectar o Google Calendar.' })
  }
})
