import { ApiRequest, json, route } from '@/server/http'
import { requireAdmin } from '@/server/auth/session'
import { consultarCapacidade } from '@/server/services/admin-capacidade'

export const dynamic = 'force-dynamic'

export const GET = route(async (req) => {
  await requireAdmin(await ApiRequest.from(req))
  return json(await consultarCapacidade(), 200, { headers: { 'Cache-Control': 'private, no-store' } })
})
