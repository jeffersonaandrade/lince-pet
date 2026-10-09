import { ApiRequest, ok, route } from '@/server/http'
import { requireUser } from '@/server/auth/session'
import { listarRecebidos } from '@/server/services/encaminhamentos'

/** GET /encaminhamentos/recebidos?status=enviado|aceito|recusado */
export const GET = route(async (req) => {
  const apiReq = await ApiRequest.from(req)
  const user = await requireUser(apiReq, ['veterinario', 'clinica', 'prestador'])
  return ok({ data: await listarRecebidos(user, apiReq.input<string | null>('status', null)) })
})
