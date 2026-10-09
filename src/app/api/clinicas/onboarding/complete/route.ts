import { prisma } from '@/server/db'
import { ApiRequest, ok, route, unauthorized } from '@/server/http'
import { requireUser } from '@/server/auth/session'
import { updating } from '@/server/lucid'

export const POST = route(async (req) => {
  const currentUser = await requireUser(await ApiRequest.from(req))
  if (!currentUser.clinica) {
    return unauthorized({ message: 'Acesso negado' })
  }

  await prisma.clinica.update({
    where: { id: currentUser.clinica.id },
    data: updating({ onboardingComplete: 1 }),
  })

  return ok({ message: 'Onboarding concluído' })
})
