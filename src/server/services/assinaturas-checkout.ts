import 'server-only'
import { prisma } from '@/server/db'
import { HttpError } from '@/server/http'
import type { CurrentUser } from '@/server/auth/session'
import { assinanteDe, assinaturasDo } from './assinante'
import type { AsaasFactory } from './assinaturas'
import { urlFaturaAsaas } from '@/lib/pagamento-navegacao'
import { respostaDoAsaas } from './asaas'

/** Não recebe IDs externos: a fatura é obtida a partir das assinaturas do titular. */
export async function prepararCheckout(user: CurrentUser, factory: AsaasFactory) {
  const dono = assinanteDe(user)
  if (!dono) throw new HttpError(403, { message: 'Perfil sem assinatura de cobrança.' })
  const where = assinaturasDo(dono)
  const [subs, cancelamento] = await Promise.all([
    prisma.subscription.findMany({ where: { ...where, status: { in: ['pending', 'past_due'] } }, orderBy: { createdAt: 'desc' }, take: 10 }),
    prisma.asaasCancelamento.findFirst({ where: { concluidoEm: null, subscription: where }, select: { subscriptionId: true } }),
  ])
  if (cancelamento) throw new HttpError(409, { message: 'Há um cancelamento em andamento. Confira sua assinatura no painel.' })
  const sub = subs.find(s => s.status === 'pending') ?? subs.find(s => s.status === 'past_due')
  if (!sub?.asaasSubscriptionId) return { checkoutUrl: null }
  try {
    const asaas = factory()
    const payments = (await asaas.getSubscriptionPayments(sub.asaasSubscriptionId)).data || []
    const fatura = payments.filter(p => ['PENDING', 'OVERDUE'].includes(p.status)).sort((a, b) => a.dueDate.localeCompare(b.dueDate))[0]
    if (!fatura) return { checkoutUrl: null }
    const checkoutUrl = urlFaturaAsaas(fatura.invoiceUrl)
    if (!checkoutUrl || !/^pay_[\w-]+$/.test(fatura.id)) throw new HttpError(502, { message: 'O provedor não retornou uma página de pagamento válida. Tente novamente.' })
    await asaas.configurarRetornoPagamento(fatura.id)
    // Cancelamento ou confirmação podem ocorrer enquanto a configuração remota é enviada.
    const atual = await prisma.subscription.findFirst({ where: { id: sub.id, ...where, status: { in: ['pending', 'past_due'] } } })
    if (!atual) return { checkoutUrl: null }
    return { checkoutUrl }
  } catch (error) {
    if (error instanceof HttpError) throw error
    console.error('[Assinaturas.checkout] Provedor indisponível:', respostaDoAsaas(error))
    throw new HttpError(502, { message: 'Não foi possível preparar o pagamento no Asaas. Tente novamente.' })
  }
}
