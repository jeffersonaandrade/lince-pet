import { requireClinica } from '@/server/auth/session'
import { ApiRequest, ok, route } from '@/server/http'
import { salvarRt, serializarRt } from '@/server/services/aprovacoes'

export const GET = route(async (req) => {
  const clinica = await requireClinica(await ApiRequest.from(req))
  return ok(serializarRt(clinica))
})

export const PUT = route(async (req) => {
  const request = await ApiRequest.from(req)
  const clinica = await requireClinica(request)
  return ok(await salvarRt(clinica.id, request.body))
})
