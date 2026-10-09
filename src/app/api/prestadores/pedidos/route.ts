import { ApiRequest, ok, route } from '@/server/http'
import { requireUser } from '@/server/auth/session'
import { prestadorDoUsuario } from '@/server/services/prestadores'
import { listarPedidosDoPrestador } from '@/server/services/pedidos-prestador'

/** GET /prestadores/pedidos?status= : pedidos recebidos pelo prestador logado. */
export const GET = route(async (req) => {
  const apiReq = await ApiRequest.from(req)
  const user = await requireUser(apiReq, ['prestador'])
  const prestador = await prestadorDoUsuario(user.id)
  return ok({ data: await listarPedidosDoPrestador(prestador.id, apiReq.qs().status || undefined) })
})