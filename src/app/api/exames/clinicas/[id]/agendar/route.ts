import { requireTutor } from '@/server/auth/session'
import { ApiRequest, created, route } from '@/server/http'
import { agendarExame } from '@/server/services/exames'

/** POST /exames/clinicas/:id/agendar: tutor agenda exames (já confirmado, pagamento na clínica). */
export const POST = route<{ id: string }>(async (req, { id }) => {
  const request = await ApiRequest.from(req)
  const tutor = await requireTutor(request)
  return created({ agendamento: await agendarExame(tutor, id, request.body) })
})
