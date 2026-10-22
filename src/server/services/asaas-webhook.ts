import 'server-only'
import { Prisma } from '@/generated/prisma/client'
import { prisma } from '../db'
import { updating } from '../lucid'
import { AsaasService } from './asaas'
import { PLANO_PADRAO, assinanteDaAssinatura, assinaturasDo, definirPlano, planoAtualDe } from './assinante'
import { fimDoPeriodo } from './assinatura-regras'

type Tx = Prisma.TransactionClient

/** Campos do evento do Asaas que o sistema usa; o corpo inteiro fica só no log (`webhook_events.payload`). */
export type AsaasEvento = {
  id?: string
  event?: string
  payment?: { id?: string; subscription?: string; dueDate?: string }
  subscription?: { id?: string }
}

const textoNaoVazio = (v: unknown) => (typeof v === 'string' && v ? v : undefined)
const objeto = (v: unknown) => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : undefined)

export function lerEventoAsaas(payload: unknown): AsaasEvento {
  const corpo = objeto(payload) ?? {}
  const payment = objeto(corpo.payment)
  const subscription = objeto(corpo.subscription)
  return {
    id: textoNaoVazio(corpo.id),
    event: textoNaoVazio(corpo.event),
    payment: payment && {
      id: textoNaoVazio(payment.id),
      subscription: textoNaoVazio(payment.subscription),
      dueDate: textoNaoVazio(payment.dueDate),
    },
    subscription: subscription && { id: textoNaoVazio(subscription.id) },
  }
}

/**
 * Chave de idempotência (coluna única webhook_events.event_id): o `id` do evento enviado pelo Asaas;
 * sem ele, `asaas:<event>:<payment.id|subscription.id>`. Sem nenhum dos dois, não há deduplicação.
 */
export function asaasEventKey(payload: unknown): string | null {
  const evento = lerEventoAsaas(payload)
  if (evento.id) return evento.id
  const ref = evento.payment?.id || evento.subscription?.id
  return evento.event && ref ? `asaas:${evento.event}:${ref}` : null
}

const isUniqueViolation = (e: unknown) => e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002'

/** Retorna false se o evento já tinha sido processado. */
export async function handleAsaasEvent(payload: unknown): Promise<boolean> {
  const evento = lerEventoAsaas(payload)
  const eventType = evento.event || ''
  const eventKey = asaasEventKey(payload)

  if (eventKey && (await prisma.webhookEvent.findUnique({ where: { eventId: eventKey } }))) {
    console.log(`[Webhook Asaas] Evento ${eventKey} já processado, ignorando.`)
    return false
  }

  try {
    await prisma.$transaction(
      async (tx) => {
        if (eventKey) {
          const now = new Date()
          await tx.webhookEvent.create({
            data: { provider: 'asaas', eventId: eventKey, type: eventType || 'unknown', payload: JSON.stringify(payload ?? {}), processedAt: now, createdAt: now },
          })
        }
        await processEvent(tx, evento, eventType)
      },
      { maxWait: 10_000, timeout: 60_000 }
    )
  } catch (error) {
    if (eventKey && isUniqueViolation(error)) {
      console.log(`[Webhook Asaas] Evento ${eventKey} já processado (concorrente), ignorando.`)
      return false
    }
    throw error
  }
  return true
}

/** Pagamento da cobrança confirmado: ativa a assinatura e aplica o plano. */
export const EVENTOS_PAGO = ['PAYMENT_CONFIRMED', 'PAYMENT_RECEIVED']
/** Inadimplência: fatura vencida, estorno, chargeback ou recebimento desfeito. */
export const EVENTOS_INADIMPLENTE = [
  'PAYMENT_OVERDUE',
  'PAYMENT_REFUNDED',
  'PAYMENT_CHARGEBACK_REQUESTED',
  'PAYMENT_RECEIVED_IN_CASH_UNDONE',
]
/** Assinatura encerrada no Asaas. */
export const EVENTOS_ENCERRADA = ['SUBSCRIPTION_DELETED', 'SUBSCRIPTION_INACTIVATED']

type SubLocal = Prisma.SubscriptionGetPayload<object>

/** Volta ao plano padrão do tipo, salvo se o dono ainda tiver outra assinatura ativa. */
async function rebaixar(tx: Tx, sub: SubLocal, motivo: string) {
  const dono = assinanteDaAssinatura(sub)
  if (!dono) return
  const outrasAtivas = await tx.subscription.count({
    where: { ...assinaturasDo(dono), status: 'active', id: { not: sub.id } },
  })
  if (outrasAtivas > 0) return
  const padrao = PLANO_PADRAO[dono.tipo]
  const atual = await planoAtualDe(tx, dono)
  if (atual !== undefined && atual !== padrao) {
    await definirPlano(tx, dono, padrao, false)
    console.log(`[Webhook Asaas] ${dono.tipo} ${dono.id} voltou ao plano ${padrao} (${motivo}).`)
  }
}

async function ativarPorPagamento(tx: Tx, sub: SubLocal, payment: NonNullable<AsaasEvento['payment']>) {
  if (sub.status === 'canceled' || sub.status === 'expired') {
    console.warn(`[Webhook Asaas] Pagamento ${payment.id} de assinatura encerrada ${sub.id}; nada a ativar.`)
    return
  }
  const periodo = payment.dueDate
    ? { currentPeriodStart: new Date(`${payment.dueDate}T00:00:00Z`), currentPeriodEnd: fimDoPeriodo(payment.dueDate) }
    : {}
  await tx.subscription.update({ where: { id: sub.id }, data: updating({ status: 'active', ...periodo }) })

  const dono = assinanteDaAssinatura(sub)
  if (!dono) return

  const antigas = await tx.subscription.findMany({
    where: { id: { not: sub.id }, ...assinaturasDo(dono), status: { in: ['active', 'pending', 'past_due'] } },
  })
  if (antigas.length > 0) {
    const service = new AsaasService()
    for (const antiga of antigas) {
      if (antiga.asaasSubscriptionId) {
        try {
          await service.cancelSubscription(antiga.asaasSubscriptionId)
        } catch (e) {
          console.error(`[Webhook Asaas] Falha ao cancelar ${antiga.asaasSubscriptionId} no Asaas:`, e)
        }
      }
      await tx.subscription.update({
        where: { id: antiga.id },
        data: updating({ status: 'canceled', canceledAt: new Date() }),
      })
    }
  }

  const plan = await tx.subscriptionPlan.findUnique({ where: { id: sub.planId } })
  if (!plan) return
  const atual = await planoAtualDe(tx, dono)
  if (atual !== undefined && atual !== plan.code) {
    await definirPlano(tx, dono, plan.code)
    console.log(`[Webhook Asaas] ${dono.tipo} ${dono.id} no plano ${plan.code} (pagamento confirmado).`)
  }
}

async function processEvent(tx: Tx, evento: AsaasEvento, eventType: string) {
  const asaasSubId = evento.payment?.subscription || evento.subscription?.id
  if (!asaasSubId) return
  const sub = await tx.subscription.findFirst({ where: { asaasSubscriptionId: asaasSubId } })
  if (!sub) return

  if (evento.payment && EVENTOS_PAGO.includes(eventType)) {
    await ativarPorPagamento(tx, sub, evento.payment)
    return
  }

  if (evento.payment && EVENTOS_INADIMPLENTE.includes(eventType)) {
    if (sub.status === 'canceled' || sub.status === 'expired') return
    await tx.subscription.update({ where: { id: sub.id }, data: updating({ status: 'past_due' }) })
    await rebaixar(tx, sub, eventType)
    return
  }

  if (EVENTOS_ENCERRADA.includes(eventType)) {
    if (sub.status !== 'canceled') {
      await tx.subscription.update({
        where: { id: sub.id },
        data: updating({ status: 'canceled', canceledAt: sub.canceledAt ?? new Date() }),
      })
    }
    await rebaixar(tx, sub, eventType)
  }
}
