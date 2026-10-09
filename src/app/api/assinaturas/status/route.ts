import { prisma } from '@/server/db'
import { ApiRequest, forbidden, ok, route, serverError } from '@/server/http'
import { requireUser } from '@/server/auth/session'

export const GET = route(async (req) => {
  const user = await requireUser(await ApiRequest.from(req), ['veterinario', 'clinica'])
  try {
    const isVet = user.userType === 'veterinario'
    const entity = isVet ? user.veterinario : user.userType === 'clinica' ? user.clinica : null
    if (!entity) return forbidden({ message: 'Apenas veterinários e clínicas podem ver status' })

    const currentPlan = await prisma.subscriptionPlan.findUnique({
      where: { code: entity.subscriptionPlanCode || (isVet ? 'none' : 'starter') },
    })

    const activeSub = await prisma.subscription.findFirst({
      where: {
        ...(isVet ? { veterinarioId: entity.id } : { clinicaId: entity.id }),
        status: { notIn: ['canceled', 'expired'] },
      },
      orderBy: { createdAt: 'desc' },
    })

    return ok({
      plan: currentPlan,
      usage: {
        used: isVet ? user.veterinario!.monthlyAppointmentsUsed : 0,
        limit: currentPlan?.monthlyAppointmentLimit,
      },
      subscription: activeSub,
    })
  } catch (error) {
    console.error('[AssinaturasController.status] error:', error)
    return serverError({ message: 'Falha ao buscar status da assinatura' })
  }
})
