import { ApiRequest, notFound, ok, route, serverError, unauthorized } from '@/server/http'
import { requireUser } from '@/server/auth/session'
import { recusarVinculo } from '@/server/services/vinculos'

export const PATCH = route<{ clinicaId: string }>(async (req, { clinicaId }) => {
  const currentUser = await requireUser(await ApiRequest.from(req))
  try {
    if (currentUser.userType !== 'veterinario') return unauthorized({ message: 'Acesso negado' })

    if (!(await recusarVinculo(currentUser, clinicaId))) {
      return notFound({ message: 'Solicitação não encontrada' })
    }
    return ok({ message: 'Vínculo recusado.' })
  } catch (error) {
    console.error('❌ Erro ao recusar vínculo:', error)
    return serverError({ message: 'Erro ao recusar vínculo' })
  }
})
