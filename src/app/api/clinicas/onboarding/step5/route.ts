import { ApiRequest, ok, route, unauthorized } from '@/server/http'
import { requireUser } from '@/server/auth/session'
import { syncPlanosClinica } from '@/server/services/clinicas'

export const POST = route(async (req) => {
  const request = await ApiRequest.from(req)
  const currentUser = await requireUser(request)
  if (!currentUser.clinica) {
    return unauthorized({ message: 'Acesso negado' })
  }

  const { planos } = request.only(['planos'])

  if (Array.isArray(planos)) {
    await syncPlanosClinica(currentUser.clinica.id, planos)
  }

  return ok({ message: 'Planos de saúde salvos com sucesso' })
})
