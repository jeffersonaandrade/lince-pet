import { ApiRequest, json, route } from '@/server/http'
import { requireAdmin } from '@/server/auth/session'
import { consultarPainel } from '@/server/services/admin-dashboard'

export const dynamic = 'force-dynamic'

export const GET = route(async (req) => {
  await requireAdmin(await ApiRequest.from(req))
  return json(await consultarPainel(), 200, { headers: { 'Cache-Control': 'private, no-store' } })
})
