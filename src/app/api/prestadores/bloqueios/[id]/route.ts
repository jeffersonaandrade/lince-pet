import { ApiRequest, ok, route } from '@/server/http'
import { requireUser } from '@/server/auth/session'
import { prestadorDoUsuario } from '@/server/services/prestadores'
import { removerBloqueioPrestador } from '@/server/services/pedidos-prestador'

/** DELETE /prestadores/bloqueios/:id */
export const DELETE = route<{ id: string }>(async (req, { id }) => {
  const user = await requireUser(await ApiRequest.from(req), ['prestador'])
  const prestador = await prestadorDoUsuario(user.id)
  await removerBloqueioPrestador(prestador.id, id)
  return ok({ message: 'Bloqueio removido' })
})