import { requireClinica } from '@/server/auth/session'
import { ApiRequest, created, route } from '@/server/http'
import { criarCombo } from '@/server/services/exames'

export const POST = route(async (req) => {
  const request = await ApiRequest.from(req)
  const clinica = await requireClinica(request)
  return created(await criarCombo(clinica.id, request.body))
})
