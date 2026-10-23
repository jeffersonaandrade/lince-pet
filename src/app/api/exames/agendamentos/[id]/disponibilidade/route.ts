import { requireTutor } from '@/server/auth/session'
import { ApiRequest, ok, route } from '@/server/http'
import { disponibilidadeParaRemarcar } from '@/server/services/exames'

/** GET /exames/agendamentos/:id/disponibilidade?data=: horários para o tutor remarcar o exame. */
export const GET = route<{ id: string }>(async (req, { id }) => {
  const request = await ApiRequest.from(req)
  const tutor = await requireTutor(request)
  return ok(await disponibilidadeParaRemarcar(tutor.id, id, request.text('data') || ''))
})
