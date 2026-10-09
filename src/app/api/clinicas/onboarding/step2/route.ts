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

  const { comodidades } = request.only(['comodidades'])

  if (comodidades) {
    await prisma.clinica.update({
      where: { id: currentUser.clinica.id },
      data: updating({ comodidades: toJsonColumn(comodidades) }),
    })
  }

  return ok({ message: 'Informações do local salvas com sucesso' })
})
