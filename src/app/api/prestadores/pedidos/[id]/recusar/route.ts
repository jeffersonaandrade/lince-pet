import { ApiRequest, ok, route } from '@/server/http'
import { requireUser } from '@/server/auth/session'
import { prestadorDoUsuario } from '@/server/services/prestadores'
import { recusarPedido } from '@/server/services/pedidos-prestador'

/** PATCH /prestadores/pedidos/:id/recusar { motivo? }: recusa um pendente ou cancela um aceito. */
export const PATCH = route<{ id: string }>(async (req, { id }) => {
  const apiReq = await ApiRequest.from(req)
  const user = await requireUser(apiReq, ['prestador'])
  const prestador = await prestadorDoUsuario(user.id)
  const { motivo } = apiReq.only(['motivo']) as { motivo?: string }
  return ok({ message: 'Pedido recusado', data: await recusarPedido(prestador.id, id, motivo) })
})