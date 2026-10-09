import { prisma } from '@/server/db'
import { ApiRequest, ok, route, serverError, unauthorized } from '@/server/http'
import { requireUser } from '@/server/auth/session'

export const DELETE = route<{ id: string }>(async (req, { id }) => {
  const currentUser = await requireUser(await ApiRequest.from(req))
  if (!currentUser.clinica) {
    return unauthorized({ message: 'Usuário não autenticado ou não é clínica' })
  }

  try {
    await prisma.veterinarioClinica.deleteMany({
      where: { clinicaId: currentUser.clinica.id, veterinarioId: id },
    })
    return ok({ message: 'Veterinário removido com sucesso' })
  } catch (error) {
    console.error(error)
    return serverError({ message: 'Erro ao remover veterinário' })
  }
})
