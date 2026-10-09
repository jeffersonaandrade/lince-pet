import { prisma } from '@/server/db'
import { ApiRequest, badRequest, forbidden, ok, route, serverError } from '@/server/http'
import { requireUser } from '@/server/auth/session'
import { updating } from '@/server/lucid'
import { AsaasService } from '@/server/services/asaas'

export const DELETE = route<{ id: string }>(async (req) => {
  const user = await requireUser(await ApiRequest.from(req), ['veterinario', 'clinica'])
  try {
    const isVet = user.userType === 'veterinario'
    const entity = isVet ? user.veterinario : user.userType === 'clinica' ? user.clinica : null
    if (!entity) return forbidden({ message: 'Apenas veterinários e clínicas podem cancelar assinaturas' })

    const activeSub = await prisma.subscription.findFirst({
      where: {
        ...(isVet ? { veterinarioId: entity.id } : { clinicaId: entity.id }),
        status: { notIn: ['canceled', 'expired'] },
      },
      orderBy: { createdAt: 'desc' },
    })
    if (!activeSub) return badRequest({ message: 'Nenhuma assinatura ativa encontrada.' })

    if (activeSub.asaasSubscriptionId) {
      const service = new AsaasService()
      try {
        await service.cancelSubscription(activeSub.asaasSubscriptionId)
      } catch (e) {
        console.error('[AssinaturasController.cancel] Falha ao cancelar no Asaas:', e)
      }
    }

    await prisma.subscription.update({
      where: { id: activeSub.id },
      data: updating({ status: 'canceled', canceledAt: new Date() }),
    })

    const fallbackCode = isVet ? 'none' : 'starter'
    if (entity.subscriptionPlanCode !== fallbackCode) {
      const data = updating({ subscriptionPlanCode: fallbackCode })
      if (isVet) await prisma.veterinario.update({ where: { id: entity.id }, data })
      else await prisma.clinica.update({ where: { id: entity.id }, data })
    }

    return ok({ message: 'Assinatura cancelada com sucesso' })
  } catch (error) {
    console.error('[AssinaturasController.cancel] error:', error)
    return serverError({ message: 'Falha ao cancelar assinatura' })
  }
})
