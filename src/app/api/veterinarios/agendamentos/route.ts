import { ApiRequest, ok, route, serverError } from '@/server/http'
import { requireUser } from '@/server/auth/session'
import { agendamentosError, findVeterinarioByUser, listAgendamentos } from '@/server/services/veterinario-dashboard'

export const GET = route(async (req) => {
  const apiReq = await ApiRequest.from(req)
  const user = await requireUser(apiReq, ['veterinario'])
  try {
    const veterinario = await findVeterinarioByUser(user.id)
    if (!veterinario) {
      return ok({
        agendamentos: [],
        mensagem: 'Complete o onboarding para começar a receber agendamentos',
      })
    }
    return ok({ agendamentos: await listAgendamentos(veterinario, apiReq.qs()) })
  } catch (error) {
    console.error('❌ [Dashboard] Erro ao listar agendamentos:', error)
    return serverError(agendamentosError(error))
  }
})
