import { ApiRequest, ok, route, serverError } from '@/server/http'
import { requireUser } from '@/server/auth/session'
import { estatisticas, estatisticasError, findVeterinarioByUser } from '@/server/services/veterinario-dashboard'

export const GET = route(async (req) => {
  const user = await requireUser(await ApiRequest.from(req), ['veterinario'])
  try {
    const veterinario = await findVeterinarioByUser(user.id)
    if (!veterinario) {
      return ok({
        agendamentosHoje: 0,
        agendamentosSemana: 0,
        agendamentosMes: 0,
        totalClientes: 0,
        mensagem: 'Complete o onboarding para começar a usar o dashboard',
      })
    }
    return ok(await estatisticas(veterinario.id))
  } catch (error) {
    console.error('❌ [Dashboard] Erro ao buscar estatísticas:', error)
    return serverError(estatisticasError(error))
  }
})
