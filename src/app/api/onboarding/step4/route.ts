import { ApiRequest, json, route } from '@/server/http'
import { requireUser } from '@/server/auth/session'
import { step4Validator } from '@/server/validators/onboarding'
import { processStep4 } from '@/server/services/onboarding'

export const POST = route(async (req) => {
  const apiReq = await ApiRequest.from(req)
  const currentUser = await requireUser(apiReq, ['veterinario'])
  const payload = await step4Validator.validate(apiReq.all())
  const result = await processStep4(currentUser, payload)
  return json(result, result.success ? 200 : 400)
})
