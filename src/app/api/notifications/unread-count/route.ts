import { prisma } from '@/server/db'
import { ApiRequest, ok, route, serverError } from '@/server/http'
import { requireUser } from '@/server/auth/session'

export const GET = route(async (req) => {
  const user = await requireUser(await ApiRequest.from(req))
  try {
    const unreadCount = await prisma.notification.count({ where: { userId: user.id, isRead: 0 } })
    return ok({ unreadCount })
  } catch (error) {
    console.error('[Notifications] Erro ao contar não-lidas:', error)
    return serverError({ message: 'Erro ao contar notificações' })
  }
})
