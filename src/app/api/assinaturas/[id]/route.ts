import { prisma } from '@/server/db'
import { ApiRequest, badRequest, forbidden, ok, route, serverError } from '@/server/http'
import { requireUser } from '@/server/auth/session'
import { updating } from '@/server/lucid'
import { AsaasService } from '@/server/services/asaas'
import { assinanteDe, assinaturasDo, definirPlano } from '@/server/services/assinante'

export const DELETE = route<{ id: string }>(async (req) => {
  const user = await requireUser(await ApiRequest.from(req), ['veterinario', 'clinica', 'prestador'])
  try {
    const assinante = assinanteDe(user)
    if (!assinante) return forbidden({ message: 'Apenas veterinários, clínicas e profissionais podem cancelar assinaturas' })

    const activeSub = await prisma.subscription.findFirst({
      where: { ...assinaturasDo(assinante), status: { notIn: ['canceled', 'expired'] } },
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

    if (assinante.planoAtual !== assinante.planoPadrao) {
      await prisma.$transaction((tx) => definirPlano(tx, assinante, assinante.planoPadrao, false))
    }

    return ok({ message: 'Assinatura cancelada com sucesso' })
  } catch (error) {
    console.error('[AssinaturasController.cancel] error:', error)
    return serverError({ message: 'Falha ao cancelar assinatura' })
  }
})
