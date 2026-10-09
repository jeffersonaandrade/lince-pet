import { prisma } from '@/server/db'
import { ApiRequest, ok, route, serverError } from '@/server/http'
import { requireUser } from '@/server/auth/session'
import { pageParams, paginate } from '@/server/lucid'

export const GET = route(async (req) => {
  const request = await ApiRequest.from(req)
  const user = await requireUser(request)
  try {
    const { page, perPage, skip, take } = pageParams(request.input('page', 1), 15)
    const where = { userId: user.id }
    const [rows, total] = await Promise.all([
      prisma.notification.findMany({ where, orderBy: { createdAt: 'desc' }, skip, take }),
      prisma.notification.count({ where }),
    ])
    const data = rows.map((n) => ({
      id: n.id,
      type: n.type,
      title: n.title,
      message: n.message,
      is_read: n.isRead,
      action_data: n.actionData,
      created_at: n.createdAt,
    }))
    const { meta } = paginate(data, total, page, perPage)
    return ok({ meta, data })
  } catch (error) {
    console.error('[Notifications] Erro ao buscar notificações:', error)
    return serverError({ message: 'Erro ao carregar notificações' })
  }
})
