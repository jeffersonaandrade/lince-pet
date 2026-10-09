import { ApiRequest, ok, route } from '@/server/http'
import { requireUser } from '@/server/auth/session'
import { recusarEncaminhamento } from '@/server/services/encaminhamentos'

/** POST /encaminhamentos/:id/recusar { motivo } */
export const POST = route<{ id: string }>(async (req, { id }) => {
  const apiReq = await ApiRequest.from(req)
  const user = await requireUser(apiReq, ['veterinario', 'clinica', 'prestador'])
  return ok({ message: 'Encaminhamento recusado', data: await recusarEncaminhamento(user, id, apiReq.input('motivo')) })
})
