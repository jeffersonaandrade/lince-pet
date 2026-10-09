import { ApiRequest, json, route } from '@/server/http'
import { requireUser } from '@/server/auth/session'
import { step3Validator } from '@/server/validators/onboarding'
import { processStep3 } from '@/server/services/onboarding'

export const POST = route(async (req) => {
  const apiReq = await ApiRequest.from(req)
  const currentUser = await requireUser(apiReq, ['veterinario'])
  const payload = await step3Validator.validate(apiReq.all())
  const result = await processStep3(currentUser, payload)
  return json(result, result.success ? 200 : 400)
})
