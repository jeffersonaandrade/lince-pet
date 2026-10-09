import { ApiRequest, HttpError, ok, route, serverError, unauthorized } from '@/server/http'
import { requireUser } from '@/server/auth/session'
import { removerDaEquipe } from '@/server/services/clinica-equipe'

export const DELETE = route<{ id: string }>(async (req, { id }) => {
  const currentUser = await requireUser(await ApiRequest.from(req))
  if (!currentUser.clinica) {
    return unauthorized({ message: 'Usuário não autenticado ou não é clínica' })
  }

  try {
    await removerDaEquipe(currentUser.clinica.id, id)
    return ok({ message: 'Veterinário removido com sucesso' })
  } catch (error) {
    if (error instanceof HttpError) throw error
    console.error(error)
    return serverError({ message: 'Erro ao remover veterinário' })
  }
})
