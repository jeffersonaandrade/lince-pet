import { ApiRequest, json, ok, route } from '@/server/http'
import { requireUser } from '@/server/auth/session'
import { obterAgendaConfig, salvarAgendaConfig } from '@/server/services/agenda-config'

export const GET = route(async req => {
  const user = await requireUser(await ApiRequest.from(req), ['veterinario'])
  return json(await obterAgendaConfig(user.veterinario!.id), 200, { headers: { 'Cache-Control': 'private, no-store' } })
})
export const PUT = route(async req => {
  const request = await ApiRequest.from(req)
  const user = await requireUser(request, ['veterinario'])
  await salvarAgendaConfig(user.veterinario!.id, request.body)
  return ok({ message: 'Agenda atualizada. Os atendimentos já reservados mantêm sua duração e deslocamento.' })
})
