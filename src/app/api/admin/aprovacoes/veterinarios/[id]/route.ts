import { ApiRequest, ok, route } from '@/server/http'
import { requireAdmin } from '@/server/auth/session'
import { decidirCrmv } from '@/server/services/aprovacoes'

/** POST /admin/aprovacoes/veterinarios/:id { decisao: aprovar|reprovar, motivo } */
export const POST = route<{ id: string }>(async (req, { id }) => {
  const request = await ApiRequest.from(req)
  await requireAdmin(request)
  return ok(await decidirCrmv(id, request.body))
})
