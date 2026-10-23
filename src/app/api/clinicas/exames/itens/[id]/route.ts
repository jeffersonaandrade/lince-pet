import { requireClinica } from '@/server/auth/session'
import { ApiRequest, ok, route } from '@/server/http'
import { atualizarExame, removerExame } from '@/server/services/exames'

export const PUT = route<{ id: string }>(async (req, { id }) => {
  const request = await ApiRequest.from(req)
  const clinica = await requireClinica(request)
  return ok(await atualizarExame(clinica.id, id, request.body))
})

export const DELETE = route<{ id: string }>(async (req, { id }) => {
  const clinica = await requireClinica(await ApiRequest.from(req))
  return ok(await removerExame(clinica.id, id))
})
