import 'server-only'
import { Prisma } from '@prisma/client'
import { prisma } from '../db'
import { updating } from '../lucid'
import { AsaasService } from './asaas'

type Tx = Prisma.TransactionClient

/**
 * Chave de idempotência (coluna única webhook_events.event_id): o `id` do evento enviado pelo Asaas;
 * sem ele, `asaas:<event>:<payment.id|subscription.id>`. Sem nenhum dos dois, não há deduplicação.
 */
export function asaasEventKey(payload: any): string | null {
  if (typeof payload?.id === 'string' && payload.id) return payload.id
  const ref = payload?.payment?.id || payload?.subscription?.id
  return payload?.event && ref ? `asaas:${payload.event}:${ref}` : null
}

const isUniqueViolation = (e: unknown) => e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002'

/** Retorna false se o evento já tinha sido processado. */
export async function handleAsaasEvent(payload: any): Promise<boolean> {
  const eventType: string = payload?.event || ''
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
        await processEvent(tx, payload, eventType)
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

async function downgradeVet(tx: Tx, subId: string, veterinarioId: string, reason: string) {
  const others = await tx.subscription.count({ where: { veterinarioId, status: 'active', id: { not: subId } } })
  if (others > 0) return
  const vet = await tx.veterinario.findUnique({ where: { id: veterinarioId } })
  if (vet && vet.subscriptionPlanCode !== 'none') {
    await tx.veterinario.update({ where: { id: vet.id }, data: updating({ subscriptionPlanCode: 'none' }) })
    console.log(`[Webhook Asaas] Veterinário ${vet.id} rebaixado para plano none devido a ${reason}.`)
  }
}

async function processEvent(tx: Tx, payload: any, eventType: string) {
  const isPaymentConfirmed = ['PAYMENT_CONFIRMED', 'PAYMENT_RECEIVED'].includes(eventType)
  const isPaymentOverdue = ['PAYMENT_OVERDUE'].includes(eventType)

  if (payload?.payment?.subscription) {
    const localSub = await tx.subscription.findFirst({ where: { asaasSubscriptionId: payload.payment.subscription } })

    if (localSub) {
      if (isPaymentConfirmed) {
        await tx.subscription.update({ where: { id: localSub.id }, data: updating({ status: 'active' }) })
        console.log(`[Webhook Asaas] Assinatura ${localSub.id} ativada via pagamento.`)

        const otherActiveSubs = await tx.subscription.findMany({
          where: {
            id: { not: localSub.id },
            ...(localSub.veterinarioId ? { veterinarioId: localSub.veterinarioId } : {}),
            ...(localSub.clinicaId ? { clinicaId: localSub.clinicaId } : {}),
            status: { in: ['active', 'pending'] },
          },
        })

        if (otherActiveSubs.length > 0) {
          const service = new AsaasService()
          for (const otherSub of otherActiveSubs) {
            if (otherSub.asaasSubscriptionId) {
              try {
                await service.cancelSubscription(otherSub.asaasSubscriptionId)
              } catch {}
            }
            await tx.subscription.update({
              where: { id: otherSub.id },
              data: updating({ status: 'canceled', canceledAt: new Date() }),
            })
          }
          console.log(
            `[Webhook Asaas] Foram canceladas ${otherActiveSubs.length} assinaturas antigas devido à ativação do novo plano.`
          )
        }

        if (localSub.planId) {
          const plan = await tx.subscriptionPlan.findUnique({ where: { id: localSub.planId } })

          if (localSub.veterinarioId && plan) {
            const vet = await tx.veterinario.findUnique({ where: { id: localSub.veterinarioId } })
            if (vet && vet.subscriptionPlanCode !== plan.code) {
              await tx.veterinario.update({
                where: { id: vet.id },
                data: updating({
                  subscriptionPlanCode: plan.code,
                  monthlyAppointmentsUsed: 0,
                  monthlyAppointmentsResetAt: new Date(),
                }),
              })
              console.log(`[Webhook Asaas] Veterinário ${vet.id} atualizado para plano ${plan.code}.`)
            }
          }

          if (localSub.clinicaId && plan) {
            const clinica = await tx.clinica.findUnique({ where: { id: localSub.clinicaId } })
            if (clinica && clinica.subscriptionPlanCode !== plan.code) {
              await tx.clinica.update({ where: { id: clinica.id }, data: updating({ subscriptionPlanCode: plan.code }) })
              console.log(`[Webhook Asaas] Clínica ${clinica.id} atualizada para plano ${plan.code}.`)
            }
          }
        }
      } else if (isPaymentOverdue) {
        await tx.subscription.update({ where: { id: localSub.id }, data: updating({ status: 'past_due' }) })
        console.log(`[Webhook Asaas] Assinatura ${localSub.id} atrasada.`)

        if (localSub.veterinarioId) await downgradeVet(tx, localSub.id, localSub.veterinarioId, 'atraso')

        if (localSub.clinicaId) {
          const clinica = await tx.clinica.findUnique({ where: { id: localSub.clinicaId } })
          if (clinica && clinica.subscriptionPlanCode !== 'starter') {
            await tx.clinica.update({ where: { id: clinica.id }, data: updating({ subscriptionPlanCode: 'starter' }) })
            console.log(`[Webhook Asaas] Clínica ${clinica.id} rebaixada para plano starter devido a atraso.`)
          }
        }
      }
    }
  }

  if (['SUBSCRIPTION_CREATED', 'SUBSCRIPTION_UPDATED'].includes(eventType)) {
    const asaasSubId = payload?.subscription?.id
    if (asaasSubId && payload?.subscription?.status === 'ACTIVE') {
      const localSub = await tx.subscription.findFirst({ where: { asaasSubscriptionId: asaasSubId } })
      if (localSub) {
        console.log(
          `[Webhook Asaas] Evento de assinatura ${eventType} recebido para ${localSub.id}. Benefícios e ativação ocorrerão no evento PAYMENT_CONFIRMED.`
        )
      }
    }
  }

  if (eventType === 'SUBSCRIPTION_DELETED') {
    const asaasSubId = payload?.subscription?.id
    if (asaasSubId) {
      const localSub = await tx.subscription.findFirst({ where: { asaasSubscriptionId: asaasSubId } })
      if (localSub) {
        await tx.subscription.update({
          where: { id: localSub.id },
          data: updating({ status: 'canceled', canceledAt: new Date() }),
        })
        console.log(`[Webhook Asaas] Assinatura ${localSub.id} cancelada.`)

        if (localSub.veterinarioId) await downgradeVet(tx, localSub.id, localSub.veterinarioId, 'cancelamento')

        if (localSub.clinicaId) {
          const clinica = await tx.clinica.findUnique({ where: { id: localSub.clinicaId } })
          if (clinica && clinica.subscriptionPlanCode !== 'starter') {
            await tx.clinica.update({ where: { id: clinica.id }, data: updating({ subscriptionPlanCode: 'starter' }) })
          }
        }
      }
    }
  }
}
