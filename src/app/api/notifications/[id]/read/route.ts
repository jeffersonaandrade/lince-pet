import { prisma } from '@/server/db'
import { ApiRequest, notFound, ok, route, serverError } from '@/server/http'
import { requireUser } from '@/server/auth/session'
import { updating } from '@/server/lucid'

export const PATCH = route<{ id: string }>(async (req, { id }) => {
  const user = await requireUser(await ApiRequest.from(req))
  try {
    const notification = await prisma.notification.findFirst({ where: { id, userId: user.id } })
    if (!notification) return notFound({ message: 'Notificação não encontrada' })

    await prisma.notification.update({ where: { id }, data: updating({ isRead: 1 }) })
    return ok({ message: 'Notificação marcada como lida' })
  } catch (error) {
    console.error('[Notifications] Erro ao marcar como lida:', error)
    return serverError({ message: 'Erro ao atualizar notificação' })
  }
})
