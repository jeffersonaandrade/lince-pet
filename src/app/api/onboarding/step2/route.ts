import { ApiRequest, json, route } from '@/server/http'
import { requireUser } from '@/server/auth/session'
import { step2Validator } from '@/server/validators/onboarding'
import { processStep2 } from '@/server/services/onboarding'

export const POST = route(async (req) => {
  const apiReq = await ApiRequest.from(req)
  const currentUser = await requireUser(apiReq, ['veterinario'])
  const payload = await step2Validator.validate(apiReq.all())
  const result = await processStep2(currentUser, payload)
  return json(result, result.success ? 200 : 400)
})
