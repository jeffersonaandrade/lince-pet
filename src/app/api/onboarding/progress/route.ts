import { ApiRequest, json, route } from '@/server/http'
import { requireUser } from '@/server/auth/session'
import { getProgress } from '@/server/services/onboarding'

export const GET = route(async (req) => {
  const currentUser = await requireUser(await ApiRequest.from(req), ['veterinario'])
  return json(await getProgress(currentUser))
})
