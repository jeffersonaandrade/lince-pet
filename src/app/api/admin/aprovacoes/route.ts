import { ApiRequest, ok, route } from '@/server/http'
import { requireAdmin } from '@/server/auth/session'
import { listarPendentes } from '@/server/services/aprovacoes'

/** GET /admin/aprovacoes: filas de CRMV de vets e RT de clínicas em análise. */
export const GET = route(async (req) => {
  await requireAdmin(await ApiRequest.from(req))
  return ok(await listarPendentes())
})
