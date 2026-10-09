import { prisma } from '@/server/db'
import { ApiRequest, forbidden, ok, route } from '@/server/http'
import { requireUser } from '@/server/auth/session'
import { AsaasService, getPendingInvoiceUrl } from '@/server/services/asaas'
import { assinanteDe, assinaturasDo } from '@/server/services/assinante'
import { statusLabel } from '@/server/services/assinatura-regras'

export const GET = route(async (req) => {
  const user = await requireUser(await ApiRequest.from(req), ['veterinario', 'clinica', 'prestador'])
  const assinante = assinanteDe(user)
  if (!assinante) return forbidden({ message: 'Apenas veterinários, clínicas e profissionais podem ver status' })

  const [currentPlan, subs, pagasAntes] = await Promise.all([
    prisma.subscriptionPlan.findUnique({ where: { code: assinante.planoAtual || assinante.planoPadrao } }),
    prisma.subscription.findMany({ where: assinaturasDo(assinante), orderBy: { createdAt: 'desc' }, take: 10 }),
    prisma.subscription.count({ where: { ...assinaturasDo(assinante), asaasSubscriptionId: { not: null } } }),
  ])

  const vigente = subs.find((s) => s.status === 'active' || s.status === 'past_due')
  const pendente = subs.find((s) => s.status === 'pending')
  const subscription = vigente ?? pendente ?? subs[0] ?? null

  const aPagar = pendente ?? (vigente?.status === 'past_due' ? vigente : null)
  let checkoutUrl: string | null = null
  if (aPagar?.asaasSubscriptionId) {
    try {
      checkoutUrl = await getPendingInvoiceUrl(new AsaasService(), aPagar.asaasSubscriptionId)
    } catch (e) {
      console.error('[Assinaturas.status] Falha ao buscar fatura em aberto:', e)
    }
  }

  const emTeste = Boolean(vigente?.status === 'active' && vigente.trialEnd && vigente.trialEnd > new Date())

  return ok({
    plan: currentPlan,
    usage: { used: assinante.usado, limit: currentPlan?.monthlyAppointmentLimit ?? null },
    subscription,
    statusLabel: statusLabel(subscription?.status),
    pendingPlanId: pendente && vigente ? pendente.planId : null,
    emTeste,
    trialEnd: emTeste ? vigente!.trialEnd : null,
    testeDisponivel: pagasAntes === 0,
    checkoutUrl,
  })
})
