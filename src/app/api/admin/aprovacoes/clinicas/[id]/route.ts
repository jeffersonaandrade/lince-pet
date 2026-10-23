import { ApiRequest, ok, route } from '@/server/http'
import { requireAdmin } from '@/server/auth/session'
import { decidirRt } from '@/server/services/aprovacoes'

/** POST /admin/aprovacoes/clinicas/:id { decisao: aprovar|reprovar, motivo } */
export const POST = route<{ id: string }>(async (req, { id }) => {
  const request = await ApiRequest.from(req)
  await requireAdmin(request)
  return ok(await decidirRt(id, request.body))
})
