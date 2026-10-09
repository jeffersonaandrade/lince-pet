import { prisma } from '@/server/db'
import { ApiRequest, badRequest, forbidden, ok, route, serverError } from '@/server/http'
import { requireUser } from '@/server/auth/session'
import { creating, updating } from '@/server/lucid'
import { AsaasService, getCheckoutUrl, type BillingType } from '@/server/services/asaas'

export const PATCH = route<{ id: string }>(async (req, { id }) => {
  const request = await ApiRequest.from(req)
  const user = await requireUser(request, ['veterinario', 'clinica'])
  try {
    const { planCode, cycle, billingType, creditCardToken } = request.only([
      'planCode',
      'cycle',
      'billingType',
      'creditCardToken',
    ]) as { planCode?: string | null; cycle?: any; billingType?: BillingType; creditCardToken?: string }

    if (planCode === undefined) throw new Error('Undefined binding(s) detected')
    const newPlan = planCode === null ? null : await prisma.subscriptionPlan.findUnique({ where: { code: String(planCode) } })
    if (!newPlan) return badRequest({ message: 'Plano não encontrado' })

    const localSub = await prisma.subscription.findUnique({ where: { id } })
    if (!localSub) throw new Error('E_ROW_NOT_FOUND: Row not found')

    const isVet = user.userType === 'veterinario'
    const entity = isVet ? user.veterinario : user.userType === 'clinica' ? user.clinica : null
    if (!entity) return forbidden({ message: 'Apenas veterinários e clínicas podem atualizar assinatura' })
    const ownerId = isVet ? localSub.veterinarioId : localSub.clinicaId
    if (ownerId !== entity.id) throw new Error('E_ROW_NOT_FOUND: Row not found')

    const service = new AsaasService()
    const owner = isVet ? { veterinarioId: entity.id } : { clinicaId: entity.id }
    const externalReference = `${isVet ? 'vet' : 'clinica'}:${entity.id}`

    if (localSub.asaasSubscriptionId && newPlan.priceCents > 0) {
      try {
        const pendingSubs = await prisma.subscription.findMany({ where: { ...owner, status: 'pending' } })
        for (const pSub of pendingSubs) {
          if (pSub.asaasSubscriptionId) {
            try {
              await service.cancelSubscription(pSub.asaasSubscriptionId)
            } catch {}
          }
          await prisma.subscription.update({
            where: { id: pSub.id },
            data: updating({ status: 'canceled', canceledAt: new Date() }),
          })
        }

        const chosenBillingType = billingType || 'CREDIT_CARD'
        const asaasSub = await service.createSubscription({
          customerId: localSub.asaasCustomerId as string,
          value: newPlan.priceCents / 100,
          cycle: cycle || (newPlan.cycle as any) || 'MONTHLY',
          billingType: chosenBillingType,
          creditCardToken,
          trialDays: 0,
          description: `Assinatura Lince Pet ${newPlan.name} (Upgrade)`,
          externalReference,
        })

        const newSub = creating({
          veterinarioId: isVet ? entity.id : null,
          clinicaId: isVet ? null : entity.id,
          planId: newPlan.id,
          asaasSubscriptionId: asaasSub.id,
          asaasCustomerId: localSub.asaasCustomerId,
          status: 'pending',
          billingType: chosenBillingType,
        })
        await prisma.subscription.create({ data: newSub })

        const checkoutUrl = await getCheckoutUrl(service, asaasSub.id)

        return ok({
          message: 'Plano alterado. Conclua o pagamento para ativar os novos recursos.',
          subscription: newSub,
          checkoutUrl,
        })
      } catch (e: any) {
        console.error('[AssinaturasController.upgrade] Asaas error:', e?.response?.data || e)
        return badRequest({ message: 'Falha ao processar upgrade de assinatura no Asaas' })
      }
    } else if (!localSub.asaasSubscriptionId && newPlan.priceCents > 0) {
      let customer: any
      try {
        customer = isVet
          ? await service.ensureCustomerForVeterinario(user, user.veterinario!)
          : await service.ensureCustomerForClinica(user, user.clinica!)
      } catch {
        return badRequest({ message: 'Erro ao cadastrar cliente no Asaas.' })
      }

      const chosenBillingType = billingType || 'CREDIT_CARD'

      let asaasSub: any
      try {
        asaasSub = await service.createSubscription({
          customerId: customer.id,
          value: newPlan.priceCents / 100,
          cycle: cycle || (newPlan.cycle as any) || 'MONTHLY',
          billingType: chosenBillingType,
          creditCardToken,
          trialDays: newPlan.trialDays,
          description: `Assinatura Lince Pet ${newPlan.name}`,
          externalReference,
        })
      } catch (e: any) {
        console.error('[AssinaturasController.upgrade] Asaas create error:', e?.response?.data || e)
        return badRequest({ message: 'Asaas rejeitou a criação da assinatura no upgrade' })
      }

      const newSub = creating({
        veterinarioId: isVet ? entity.id : null,
        clinicaId: isVet ? null : entity.id,
        planId: newPlan.id,
        asaasSubscriptionId: asaasSub.id,
        asaasCustomerId: customer.id,
        status: 'pending',
        billingType: chosenBillingType,
      })
      await prisma.subscription.create({ data: newSub })

      let checkoutUrl: string | null = null
      if (newSub.asaasSubscriptionId) {
        try {
          checkoutUrl = await getCheckoutUrl(service, newSub.asaasSubscriptionId)
        } catch (err) {
          console.error('[AssinaturasController.upgrade] Falha ao obter fatura:', err)
        }
      }

      return ok({
        message: 'Plano atualizado com sucesso. Conclua o pagamento para ativar os novos recursos.',
        subscription: newSub,
        checkoutUrl,
      })
    }

    return new Response(null, { status: 200 })
  } catch (error) {
    console.error('[AssinaturasController.upgrade] error:', error)
    return serverError({ message: 'Falha ao fazer upgrade do plano' })
  }
})
