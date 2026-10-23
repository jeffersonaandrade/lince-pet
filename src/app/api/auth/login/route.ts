import { ApiRequest, ok, route } from '@/server/http'
import { setAuthCookie } from '@/server/auth/session'
import { login } from '@/server/services/auth'
import { loginUserValidator } from '@/server/validators/auth'
import { LIMITES, limitarTentativas } from '@/server/rate-limit'
import { exigirMesmaOrigem } from '@/server/auth/origin'

export const POST = route(async (req) => {
  exigirMesmaOrigem(req)
  limitarTentativas(req, LIMITES.login)
  const request = await ApiRequest.from(req)
  const payload = await loginUserValidator.validate(request.all())
  const result = await login(payload.email, payload.password)
  const res = ok(result)
  setAuthCookie(res, result.token)
  return res
})
