import { ApiRequest, ok, route } from '@/server/http'
import { requireUser } from '@/server/auth/session'
import { prestadorDoUsuario } from '@/server/services/prestadores'
import { concluirPedido } from '@/server/services/pedidos-prestador'

/** PATCH /prestadores/pedidos/:id/concluir */
export const PATCH = route<{ id: string }>(async (req, { id }) => {
  const user = await requireUser(await ApiRequest.from(req), ['prestador'])
  const prestador = await prestadorDoUsuario(user.id)
  return ok({ message: 'Serviço concluído', data: await concluirPedido(prestador.id, id) })
})