import { prisma } from '@/server/db'
import { ApiRequest, badRequest, created, forbidden, route, serverError } from '@/server/http'
import { requireUser } from '@/server/auth/session'
import { creating, updating } from '@/server/lucid'
import { AsaasService, getCheckoutUrl, type BillingType } from '@/server/services/asaas'

export const POST = route(async (req) => {
  const request = await ApiRequest.from(req)
  const user = await requireUser(request, ['veterinario', 'clinica'])
  try {
    const { planCode, billingType, creditCardToken, cycle } = request.only([
      'planCode',
      'billingType',
      'creditCardToken',
      'cycle',
    ]) as { planCode?: string; billingType?: BillingType; creditCardToken?: string; cycle?: any }

    if (!planCode) return badRequest({ message: 'planCode é obrigatório' })
    const plan = await prisma.subscriptionPlan.findUnique({ where: { code: String(planCode) } })
    if (!plan) return badRequest({ message: 'Plano inválido' })

    const isVet = user.userType === 'veterinario'
    const entity = isVet ? user.veterinario : user.userType === 'clinica' ? user.clinica : null
    if (!entity) return forbidden({ message: 'Apenas veterinários e clínicas podem assinar' })

    const existingSub = await prisma.subscription.findFirst({
      where: {
        ...(isVet ? { veterinarioId: entity.id } : { clinicaId: entity.id }),
        status: { in: ['active', 'pending'] },
      },
    })
    if (existingSub) {
      return badRequest({
        message:
          'Você já possui uma assinatura ativa ou pendente. Utilize a opção de alterar/atualizar plano se desejar mudar.',
      })
    }

    if (plan.priceCents === 0 || planCode === 'none') {
      const sub = creating({
        veterinarioId: isVet ? entity.id : null,
        clinicaId: isVet ? null : entity.id,
        planId: plan.id,
        status: 'active',
      })
      const now = new Date()
      await prisma.$transaction([
        prisma.subscription.create({ data: sub }),
        isVet
          ? prisma.veterinario.update({
              where: { id: entity.id },
              data: updating({ subscriptionPlanCode: planCode, monthlyAppointmentsUsed: 0, monthlyAppointmentsResetAt: now }),
            })
          : prisma.clinica.update({ where: { id: entity.id }, data: updating({ subscriptionPlanCode: planCode }) }),
      ])
      return created({ subscription: sub })
    }

    const service = new AsaasService()

    let customer: any
    try {
      customer = isVet
        ? await service.ensureCustomerForVeterinario(user, user.veterinario!)
        : await service.ensureCustomerForClinica(user, user.clinica!)
    } catch {
      throw new Error('Erro ao cadastrar cliente no Asaas.')
    }

    let asaasSub: any
    try {
      asaasSub = await service.createSubscription({
        customerId: customer.id,
        value: plan.priceCents / 100,
        cycle: cycle || (plan.cycle as any) || 'MONTHLY',
        billingType,
        creditCardToken,
        trialDays: plan.trialDays,
        description: `Assinatura Lince Pet ${plan.name}`,
        externalReference: `${isVet ? 'vet' : 'clinica'}:${entity.id}`,
      })
    } catch (e: any) {
      console.error('[AssinaturasController.create] Asaas error:', e?.response?.data || e)
      throw new Error('Asaas rejeitou a criação da assinatura')
    }

    const trialDays = plan.trialDays ?? 0
    const isTrialing = billingType === 'CREDIT_CARD' && trialDays > 0
    const sub = creating({
      veterinarioId: isVet ? entity.id : null,
      clinicaId: isVet ? null : entity.id,
      planId: plan.id,
      asaasSubscriptionId: asaasSub.id,
      asaasCustomerId: customer.id,
      status: 'pending',
      billingType,
      trialEnd: isTrialing ? new Date(Date.now() + trialDays * 86_400_000) : null,
    })
    await prisma.subscription.create({ data: sub })

    let checkoutUrl: string | null = null
    if (plan.priceCents > 0 && asaasSub?.id) {
      try {
        checkoutUrl = await getCheckoutUrl(service, asaasSub.id)
      } catch (err) {
        console.error('[AssinaturasController.create] Falha ao obter fatura da assinatura:', err)
      }
    }

    return created({ subscription: sub, asaas_subscription: asaasSub, checkoutUrl })
  } catch (error: any) {
    console.error('[AssinaturasController.create] error:', error)
    return serverError({ message: error.message || 'Falha ao criar assinatura' })
  }
})
