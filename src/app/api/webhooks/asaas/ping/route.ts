import { ok, route } from '@/server/http'

export const GET = route(async () => ok({ ok: true, provider: 'asaas' }))
