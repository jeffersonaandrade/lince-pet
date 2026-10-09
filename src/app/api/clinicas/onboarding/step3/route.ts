import { prisma } from '@/server/db'
import { ApiRequest, ok, route, unauthorized } from '@/server/http'
import { requireUser } from '@/server/auth/session'
import { updating } from '@/server/lucid'
import { toJsonColumn } from '@/server/services/clinicas'

export const POST = route(async (req) => {
  const request = await ApiRequest.from(req)
  const currentUser = await requireUser(request)
  if (!currentUser.clinica) {
    return unauthorized({ message: 'Acesso negado' })
  }

  const { horariosFuncionamento } = request.only(['horariosFuncionamento'])

  if (horariosFuncionamento) {
    await prisma.clinica.update({
      where: { id: currentUser.clinica.id },
      data: updating({ horariosFuncionamento: toJsonColumn(horariosFuncionamento) }),
    })
  }

  return ok({ message: 'Horários salvos com sucesso' })
})
