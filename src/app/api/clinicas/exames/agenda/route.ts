import { requireClinica } from '@/server/auth/session'
import { ApiRequest, ok, route } from '@/server/http'
import { agendaDeExames } from '@/server/services/exames'

/** GET /clinicas/exames/agenda?de=YYYY-MM-DD&ate=YYYY-MM-DD&status= */
export const GET = route(async (req) => {
  const request = await ApiRequest.from(req)
  const clinica = await requireClinica(request)
  const [de, ate, status] = ['de', 'ate', 'status'].map((c) => request.text(c))
  return ok({ agendamentos: await agendaDeExames(clinica.id, { de, ate, status }) })
})
