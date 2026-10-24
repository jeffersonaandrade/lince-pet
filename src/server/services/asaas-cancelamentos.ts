import 'server-only'
import type { Prisma, Subscription } from '@/generated/prisma/client'
import { prisma } from '../db'
import { AsaasService, respostaDoAsaas } from './asaas'
import { assinanteDaAssinatura, assinaturasDo, bloquearAssinante, definirPlano, PLANO_PADRAO } from './assinante'
import { updating } from '../lucid'

type Db = Prisma.TransactionClient
type Factory = () => AsaasService

/** Mesmo pedido repetido não reinicia o backoff nem apaga uma confirmação. */
export async function solicitarCancelamento(db: Db, sub: Subscription, motivo: 'usuario' | 'troca') {
  await db.asaasCancelamento.upsert({
    where: { subscriptionId: sub.id },
    create: { subscriptionId: sub.id, motivo },
    update: motivo === 'usuario' ? { motivo } : {},
  })
}

/** Também usado por SUBSCRIPTION_DELETED/INACTIVATED: evento e fila convergem atomicamente. */
export async function confirmarCancelamento(db: Db, sub: Subscription) {
  const dono = assinanteDaAssinatura(sub)
  if (dono) await bloquearAssinante(db, dono)
  await db.subscription.update({ where: { id: sub.id }, data: updating({ status: 'canceled', canceledAt: sub.canceledAt ?? new Date() }) })
  await db.asaasCancelamento.updateMany({ where: { subscriptionId: sub.id }, data: { concluidoEm: new Date(), bloqueadoAte: null, ultimoErro: null } })
  if (!dono) return
  const outraAtiva = await db.subscription.count({ where: { ...assinaturasDo(dono), status: 'active', id: { not: sub.id } } })
  if (outraAtiva === 0) await definirPlano(db, dono, PLANO_PADRAO[dono.tipo], false)
}

async function tentar(subscriptionId: string, factory: Factory) {
  const now = new Date()
  const lease = new Date(now.getTime() + 120_000)
  const claimed = await prisma.asaasCancelamento.updateMany({
    where: { subscriptionId, concluidoEm: null, proximaTentativaEm: { lte: now }, OR: [{ bloqueadoAte: null }, { bloqueadoAte: { lt: now } }] },
    data: { bloqueadoAte: lease, tentativas: { increment: 1 } },
  })
  if (claimed.count === 0) return 'ocupado' as const
  try {
    const job = await prisma.asaasCancelamento.findUniqueOrThrow({ where: { subscriptionId }, include: { subscription: true } })
    const sub = job.subscription
    if (sub.asaasSubscriptionId) {
      const service = factory()
      // Concilia inclusive DELETE que foi aceito mas cuja resposta se perdeu por timeout.
      const remote = await service.getSubscription(sub.asaasSubscriptionId)
      if (remote?.id !== sub.asaasSubscriptionId) throw new Error('Assinatura não confirmada')
      if (remote?.deleted !== true) {
        const result = await service.cancelSubscription(sub.asaasSubscriptionId)
        if (result?.deleted !== true || result?.id !== sub.asaasSubscriptionId) throw new Error('Cancelamento não confirmado')
      }
    }
    await prisma.$transaction(async tx => {
      // Webhook pode ter confirmado enquanto o DELETE estava em voo.
      const current = await tx.subscription.findUniqueOrThrow({ where: { id: subscriptionId } })
      await confirmarCancelamento(tx, current)
    })
    return 'confirmado' as const
  } catch (error) {
    const safe = respostaDoAsaas(error)
    const job = await prisma.asaasCancelamento.findUnique({ where: { subscriptionId }, select: { tentativas: true } })
    const delay = Math.min(3600, 30 * 2 ** Math.min(job?.tentativas ?? 1, 7)) * 1000
    await prisma.asaasCancelamento.updateMany({
      where: { subscriptionId, concluidoEm: null, bloqueadoAte: lease },
      data: { bloqueadoAte: null, ultimoErro: safe.codigo, proximaTentativaEm: new Date(Date.now() + delay) },
    })
    console.error('[Asaas.cancelamento] Confirmação pendente', { subscriptionId, ...safe })
    return 'pendente' as const
  }
}

/** Até três chamadas simultâneas; nenhuma chamada HTTP acontece dentro de transação. */
export async function conciliarCancelamentos(factory: Factory = () => new AsaasService(), ids?: string[]) {
  const jobs = await prisma.asaasCancelamento.findMany({
    where: { concluidoEm: null, proximaTentativaEm: { lte: new Date() }, ...(ids ? { subscriptionId: { in: ids } } : {}) },
    orderBy: { proximaTentativaEm: 'asc' }, take: 3, select: { subscriptionId: true },
  })
  const result = await Promise.all(jobs.map(job => tentar(job.subscriptionId, factory)))
  return { confirmados: result.filter(r => r === 'confirmado').length, pendentes: result.filter(r => r === 'pendente').length }
}
