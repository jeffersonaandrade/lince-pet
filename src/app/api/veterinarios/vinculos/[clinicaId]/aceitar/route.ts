import { ApiRequest, notFound, ok, route, serverError, unauthorized } from '@/server/http'
import { requireUser } from '@/server/auth/session'
import { aceitarVinculo } from '@/server/services/vinculos'

export const PATCH = route<{ clinicaId: string }>(async (req, { clinicaId }) => {
  const currentUser = await requireUser(await ApiRequest.from(req))
  try {
    if (currentUser.userType !== 'veterinario') return unauthorized({ message: 'Acesso negado' })

    if (!(await aceitarVinculo(currentUser, clinicaId))) {
      return notFound({ message: 'Solicitação de vínculo não encontrada' })
    }
    return ok({ message: 'Vínculo aceito com sucesso!' })
  } catch (error) {
    console.error('❌ Erro ao aceitar vínculo:', error)
    return serverError({ message: 'Erro ao processar aceitação de vínculo' })
  }
})
