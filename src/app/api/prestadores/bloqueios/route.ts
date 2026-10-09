import { ApiRequest, created, ok, route } from '@/server/http'
import { requireUser } from '@/server/auth/session'
import { prestadorDoUsuario } from '@/server/services/prestadores'
import { criarBloqueioPrestador, listarBloqueiosPrestador } from '@/server/services/pedidos-prestador'

/** GET /prestadores/bloqueios: bloqueios vigentes da agenda do prestador. */
export const GET = route(async (req) => {
  const user = await requireUser(await ApiRequest.from(req), ['prestador'])
  const prestador = await prestadorDoUsuario(user.id)
  return ok({ data: await listarBloqueiosPrestador(prestador.id) })
})

/** POST /prestadores/bloqueios: 409 se houver pedido ativo no período. */
export const POST = route(async (req) => {
  const apiReq = await ApiRequest.from(req)
  const user = await requireUser(apiReq, ['prestador'])
  const prestador = await prestadorDoUsuario(user.id)
  return created({ data: await criarBloqueioPrestador(prestador.id, user.id, apiReq.body) })
})