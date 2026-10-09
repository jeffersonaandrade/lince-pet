import { ApiRequest, badRequest, created, route } from '@/server/http'
import { requireUser } from '@/server/auth/session'
import { criarPedido } from '@/server/services/pedidos-prestador'

/** POST /prestadores/:id/pedidos: o tutor pede um serviço (nasce pendente). */
export const POST = route<{ id: string }>(async (req, { id }) => {
  const apiReq = await ApiRequest.from(req)
  const user = await requireUser(apiReq, ['tutor'])
  if (!user.tutor) return badRequest({ message: 'Usuário não é um tutor válido' })
  const pedido = await criarPedido({ id: user.tutor.id, user }, id, apiReq.body)
  return created({ message: 'Pedido enviado ao profissional', data: pedido })
})
