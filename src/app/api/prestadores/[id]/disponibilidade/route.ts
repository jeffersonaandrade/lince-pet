import { ApiRequest, badRequest, ok, route } from '@/server/http'
import { disponibilidade } from '@/server/services/pedidos-prestador'

/** GET /prestadores/:id/disponibilidade?servico_id=&data=YYYY-MM-DD */
export const GET = route<{ id: string }>(async (req, { id }) => {
  const { servico_id, data } = (await ApiRequest.from(req)).qs()
  if (!servico_id || !data) return badRequest({ message: 'Informe servico_id e data' })
  return ok({ data: await disponibilidade(id, servico_id, data) })
})
