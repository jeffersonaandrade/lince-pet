import 'server-only'
import { prisma } from '../db'
import { HttpError } from '../http'
import { creating, updating } from '../lucid'
import type { CurrentUser } from '../auth/session'
import { getPendingInvoiceUrl, type AsaasService } from './asaas'
import {
  type Assinante,
  assinanteDe,
  assinanteDaAssinatura,
  assinaturasDo,
  definirPlano,
  donoDaAssinatura,
  garantirClienteAsaas,
  referenciaExterna,
} from './assinante'
import { dataLocal, planoServePara, somarDias, temDireitoAoTeste } from './assinatura-regras'

/** Fábrica do cliente Asaas (as rotas passam `() => new AsaasService()`; os testes, um fake). */
export type AsaasFactory = () => AsaasService

const erro = (status: number, message: string) => new HttpError(status, { message })

function exigirAssinante(user: CurrentUser) {
  const a = assinanteDe(user)
  if (!a) throw erro(403, 'Apenas veterinários, clínicas e profissionais podem assinar')
  return a
}

async function planoContratavel(planCode: unknown, a: Assinante) {
  if (!planCode || typeof planCode !== 'string') throw erro(400, 'planCode é obrigatório')
  const plan = await prisma.subscriptionPlan.findUnique({ where: { code: planCode } })
  if (!plan || !plan.active || !planoServePara(plan.code, a.tipo)) throw erro(400, 'Plano inválido')
  return plan
}

type Plano = Awaited<ReturnType<typeof planoContratavel>>

async function faturaEmAberto(service: AsaasService, asaasSubId: string) {
  try {
    return await getPendingInvoiceUrl(service, asaasSubId)
  } catch (e) {
    console.error('[Assinaturas] Falha ao buscar fatura do Asaas:', e)
    return null
  }
}

/**
 * Cria a assinatura no Asaas (fatura com Pix, boleto ou cartão, ciclo mensal).
 * Primeira assinatura paga: teste grátis, plano já aplicado e 1a fatura no fim do teste.
 * Demais: `pending`, plano só muda no webhook de pagamento confirmado.
 */
async function assinarNoAsaas(user: CurrentUser, a: Assinante, plan: Plano, asaas: AsaasFactory, customerId?: string | null) {
  const jaTevePaga = (await prisma.subscription.count({ where: { ...assinaturasDo(a), asaasSubscriptionId: { not: null } } })) > 0
  const teste = temDireitoAoTeste(plan.trialDays, jaTevePaga)
  const hoje = new Date()
  const vencimento = teste ? somarDias(hoje, plan.trialDays ?? 0) : hoje

  const service = asaas()
  let customer = customerId
  if (!customer) {
    try {
      customer = (await garantirClienteAsaas(service, user, a)).id as string
    } catch (e: any) {
      console.error('[Assinaturas] Asaas recusou o cliente:', e?.response?.data || e)
      throw erro(400, 'Não foi possível cadastrar seus dados no Asaas. Confira CPF/CNPJ, e-mail e celular do perfil.')
    }
  }

  let asaasSub: any
  try {
    asaasSub = await service.createSubscription({
      customerId: customer!,
      value: plan.priceCents / 100,
      cycle: 'MONTHLY',
      billingType: 'UNDEFINED',
      nextDueDate: dataLocal(vencimento),
      description: `Assinatura Lince Pet ${plan.name}`,
      externalReference: referenciaExterna(a),
    })
  } catch (e: any) {
    console.error('[Assinaturas] Asaas recusou a assinatura:', e?.response?.data || e)
    throw erro(400, 'O Asaas recusou a criação da assinatura. Tente novamente em instantes.')
  }

  const sub = creating({
    ...donoDaAssinatura(a),
    planId: plan.id,
    asaasSubscriptionId: asaasSub.id as string,
    asaasCustomerId: customer!,
    status: teste ? 'active' : 'pending',
    billingType: 'UNDEFINED',
    trialEnd: teste ? vencimento : null,
    currentPeriodStart: teste ? hoje : null,
    currentPeriodEnd: teste ? vencimento : null,
  })
  await prisma.$transaction(async (tx) => {
    await tx.subscription.create({ data: sub })
    if (teste) await definirPlano(tx, a, plan.code)
  })

  const checkoutUrl = teste ? null : await faturaEmAberto(service, asaasSub.id)
  return { subscription: sub, checkoutUrl, emTeste: teste, primeiraFatura: dataLocal(vencimento) }
}

/** POST /api/assinaturas */
export async function contratarPlano(user: CurrentUser, planCode: unknown, asaas: AsaasFactory) {
  const a = exigirAssinante(user)
  const plan = await planoContratavel(planCode, a)

  const existente = await prisma.subscription.findFirst({
    where: { ...assinaturasDo(a), status: { in: ['active', 'pending'] } },
  })
  if (existente) {
    throw erro(400, 'Você já possui uma assinatura ativa ou pendente. Use a opção de alterar plano.')
  }

  if (plan.priceCents === 0) {
    const sub = creating({ ...donoDaAssinatura(a), planId: plan.id, status: 'active' })
    await prisma.$transaction(async (tx) => {
      await tx.subscription.create({ data: sub })
      await definirPlano(tx, a, plan.code)
    })
    return { subscription: sub, checkoutUrl: null, emTeste: false, primeiraFatura: null }
  }

  return assinarNoAsaas(user, a, plan, asaas)
}

/** Cancela no Asaas e localmente tudo que não estiver encerrado; o dono volta ao plano padrão. */
export async function cancelarAssinaturas(a: Assinante, asaas: AsaasFactory) {
  const abertas = await prisma.subscription.findMany({
    where: { ...assinaturasDo(a), status: { notIn: ['canceled', 'expired'] } },
  })
  if (abertas.length === 0) throw erro(400, 'Nenhuma assinatura ativa encontrada.')

  const service = abertas.some((s) => s.asaasSubscriptionId) ? asaas() : null
  for (const s of abertas) {
    if (s.asaasSubscriptionId && service) {
      try {
        await service.cancelSubscription(s.asaasSubscriptionId)
      } catch (e) {
        console.error('[Assinaturas] Falha ao cancelar no Asaas:', e)
      }
    }
  }
  await prisma.$transaction(async (tx) => {
    await tx.subscription.updateMany({
      where: { id: { in: abertas.map((s) => s.id) } },
      data: updating({ status: 'canceled', canceledAt: new Date() }),
    })
    if (a.planoAtual !== a.planoPadrao) await definirPlano(tx, a, a.planoPadrao, false)
  })
}

/**
 * PATCH /api/assinaturas/:id/upgrade. Plano pago: nova assinatura `pending` (sem teste); a atual segue
 * valendo até o pagamento ser confirmado. `none` ou plano gratuito: cancela.
 */
export async function trocarPlano(user: CurrentUser, subId: string, planCode: unknown, asaas: AsaasFactory) {
  const a = exigirAssinante(user)
  if (!planCode || typeof planCode !== 'string') throw erro(400, 'planCode é obrigatório')

  const atual = await prisma.subscription.findUnique({ where: { id: subId } })
  const dono = atual && assinanteDaAssinatura(atual)
  if (!atual || dono?.tipo !== a.tipo || dono.id !== a.id) throw erro(404, 'Assinatura não encontrada')

  if (planCode === 'none' || planCode === a.planoPadrao) {
    await cancelarAssinaturas(a, asaas)
    return { message: 'Assinatura cancelada.', subscription: null, checkoutUrl: null, emTeste: false, primeiraFatura: null }
  }

  const plan = await planoContratavel(planCode, a)
  if (plan.priceCents === 0) {
    await cancelarAssinaturas(a, asaas)
    return { message: 'Assinatura cancelada.', subscription: null, checkoutUrl: null, emTeste: false, primeiraFatura: null }
  }
  if (plan.code === a.planoAtual && atual.status === 'active') throw erro(400, 'Este já é o seu plano atual.')

  const pendentes = await prisma.subscription.findMany({ where: { ...assinaturasDo(a), status: 'pending' } })
  if (pendentes.length > 0) {
    const service = asaas()
    for (const p of pendentes) {
      if (p.asaasSubscriptionId) {
        try {
          await service.cancelSubscription(p.asaasSubscriptionId)
        } catch (e) {
          console.error('[Assinaturas] Falha ao cancelar pendente no Asaas:', e)
        }
      }
    }
    await prisma.subscription.updateMany({
      where: { id: { in: pendentes.map((p) => p.id) } },
      data: updating({ status: 'canceled', canceledAt: new Date() }),
    })
  }

  const r = await assinarNoAsaas(user, a, plan, asaas, atual.asaasCustomerId)
  return {
    message: r.emTeste
      ? 'Plano ativado no período de teste.'
      : 'Conclua o pagamento da fatura para ativar o novo plano.',
    ...r,
  }
}
