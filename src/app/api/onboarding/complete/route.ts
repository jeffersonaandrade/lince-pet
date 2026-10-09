import { ApiRequest, json, route } from '@/server/http'
import { requireUser } from '@/server/auth/session'
import { completeOnboarding } from '@/server/services/onboarding'

export const POST = route(async (req) => {
  const currentUser = await requireUser(await ApiRequest.from(req), ['veterinario'])
  const result = await completeOnboarding(currentUser)
  return json(result, result.success ? 200 : 400)
})
