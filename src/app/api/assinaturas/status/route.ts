import { prisma } from '@/server/db'
import { ApiRequest, forbidden, ok, route, serverError } from '@/server/http'
import { requireUser } from '@/server/auth/session'
import { assinanteDe, assinaturasDo } from '@/server/services/assinante'

export const GET = route(async (req) => {
  const user = await requireUser(await ApiRequest.from(req), ['veterinario', 'clinica', 'prestador'])
  try {
    const assinante = assinanteDe(user)
    if (!assinante) return forbidden({ message: 'Apenas veterinários, clínicas e profissionais podem ver status' })

    const currentPlan = await prisma.subscriptionPlan.findUnique({
      where: { code: assinante.planoAtual || assinante.planoPadrao },
    })

    const activeSub = await prisma.subscription.findFirst({
      where: { ...assinaturasDo(assinante), status: { notIn: ['canceled', 'expired'] } },
      orderBy: { createdAt: 'desc' },
    })

    return ok({
      plan: currentPlan,
      usage: {
        used: assinante.usado,
        limit: currentPlan?.monthlyAppointmentLimit,
      },
      subscription: activeSub,
    })
  } catch (error) {
    console.error('[AssinaturasController.status] error:', error)
    return serverError({ message: 'Falha ao buscar status da assinatura' })
  }
})
