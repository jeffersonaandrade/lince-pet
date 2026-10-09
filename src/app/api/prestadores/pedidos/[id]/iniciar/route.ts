import { ApiRequest, ok, route } from '@/server/http'
import { requireUser } from '@/server/auth/session'
import { prestadorDoUsuario } from '@/server/services/prestadores'
import { iniciarPedido } from '@/server/services/pedidos-prestador'

/** PATCH /prestadores/pedidos/:id/iniciar { code }: código de início informado pelo tutor. */
export const PATCH = route<{ id: string }>(async (req, { id }) => {
  const apiReq = await ApiRequest.from(req)
  const user = await requireUser(apiReq, ['prestador'])
  const prestador = await prestadorDoUsuario(user.id)
  const { code } = apiReq.only(['code']) as { code?: unknown }
  return ok({ message: 'Serviço iniciado', data: await iniciarPedido(prestador.id, id, code) })
})