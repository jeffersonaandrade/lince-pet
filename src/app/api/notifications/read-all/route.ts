import { prisma } from '@/server/db'
import { ApiRequest, ok, route, serverError } from '@/server/http'
import { requireUser } from '@/server/auth/session'

export const PATCH = route(async (req) => {
  const user = await requireUser(await ApiRequest.from(req))
  try {
    await prisma.notification.updateMany({ where: { userId: user.id, isRead: 0 }, data: { isRead: 1 } })
    return ok({ message: 'Todas as notificações foram marcadas como lidas' })
  } catch (error) {
    console.error('[Notifications] Erro ao marcar todas como lidas:', error)
    return serverError({ message: 'Erro ao atualizar notificações' })
  }
})
