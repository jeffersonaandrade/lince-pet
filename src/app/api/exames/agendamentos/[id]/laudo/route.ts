import { requireUser } from '@/server/auth/session'
import { ApiRequest, ok, route } from '@/server/http'
import { urlDoLaudo } from '@/server/services/laudos'

/** GET /exames/agendamentos/:id/laudo: URL assinada (60 s) para quem acessa o prontuário do pet. */
export const GET = route<{ id: string }>(async (req, { id }) => {
  const request = await ApiRequest.from(req)
  const user = await requireUser(request)
  return ok(await urlDoLaudo(user, id))
})
