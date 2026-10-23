import { prisma } from '@/server/db'
import { ApiRequest, badRequest, ok, route, unauthorized } from '@/server/http'
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
    if (JSON.stringify(horariosFuncionamento).length > 10_000) {
      return badRequest({ message: 'Horários excedem o tamanho permitido' })
    }
    await prisma.clinica.update({
      where: { id: currentUser.clinica.id },
      data: updating({ horariosFuncionamento: toJsonColumn(horariosFuncionamento) }),
    })
  }

  return ok({ message: 'Horários salvos com sucesso' })
})
