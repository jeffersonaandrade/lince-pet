import { ApiRequest, ok, route } from '@/server/http'
import { requireUser } from '@/server/auth/session'
import { listarPedidosDoTutor } from '@/server/services/pedidos-prestador'

/** GET /tutor/pedidos: pedidos de serviço feitos a profissionais pet. */
export const GET = route(async (req) => {
  const user = await requireUser(await ApiRequest.from(req), ['tutor'])
  return ok({ data: user.tutor ? await listarPedidosDoTutor(user.tutor.id) : [] })
})