import { ApiRequest, ok, route, unauthorized } from '@/server/http'
import { requireUser } from '@/server/auth/session'
import { syncEspecialidadesClinica } from '@/server/services/clinicas'

export const POST = route(async (req) => {
  const request = await ApiRequest.from(req)
  const currentUser = await requireUser(request)
  if (!currentUser.clinica) {
    return unauthorized({ message: 'Acesso negado' })
  }

  const { especialidades } = request.only(['especialidades'])

  if (Array.isArray(especialidades)) {
    await syncEspecialidadesClinica(currentUser.clinica.id, especialidades)
  }

  return ok({ message: 'Especialidades salvas com sucesso' })
})
