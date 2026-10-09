import { ApiRequest, ok, route } from '@/server/http'
import { requireUser } from '@/server/auth/session'
import { listarEnviados } from '@/server/services/encaminhamentos'

/** GET /encaminhamentos/enviados?agendamento_id= */
export const GET = route(async (req) => {
  const apiReq = await ApiRequest.from(req)
  const user = await requireUser(apiReq, ['veterinario', 'clinica'])
  return ok({ data: await listarEnviados(user, apiReq.input<string | null>('agendamento_id', null)) })
})
