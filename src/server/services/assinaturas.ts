import 'server-only'
import { prisma } from '../db'
import { HttpError } from '../http'
import { creating } from '../lucid'
import type { CurrentUser } from '../auth/session'
import { getPendingInvoiceUrl, respostaDoAsaas, type AsaasService, type AsaasSubscription } from './asaas'
import {
  type Assinante,
  assinanteDe,
  assinanteDaAssinatura,
  assinaturasDo,
  definirPlano,
  donoDaAssinatura,
  garantirClienteAsaas,
  referenciaExterna,
  bloquearAssinante,
} from './assinante'
import { dataLocal, planoServePara, somarDias, temDireitoAoTeste } from './assinatura-regras'
import { conciliarCancelamentos, solicitarCancelamento } from './asaas-cancelamentos'

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

type ConfirmacaoContratacao = { valorConfirmadoCentavos: unknown; aceite: unknown }
function conferirConfirmacao(plan: Plano, confirmacao?: ConfirmacaoContratacao) {
  if (!confirmacao) return // Chamadas internas; as rotas sempre enviam o objeto de confirmação.
  if (!Number.isInteger(confirmacao.valorConfirmadoCentavos) || (plan.priceCents > 0 && confirmacao.aceite !== true)) throw erro(422, 'Confira o valor mensal e confirme as condições antes de contratar.')
  if (confirmacao.valorConfirmadoCentavos !== plan.priceCents) throw erro(409, 'O preço deste plano mudou. Atualize a página e confirme o novo valor antes de contratar.')
}


async function exigirSemCancelamento(a: Assinante) {
  const pendente = await prisma.asaasCancelamento.findFirst({ where: { concluidoEm: null, subscription: assinaturasDo(a) }, select: { subscriptionId: true } })
  if (pendente) throw erro(409, 'Aguarde a confirmação do cancelamento antes de contratar outro plano.')
}

async function faturaEmAberto(service: AsaasService, asaasSubId: string) {
  try {
    return await getPendingInvoiceUrl(service, asaasSubId)
  } catch (e) {
    console.error('[Assinaturas] Falha ao buscar fatura do Asaas:', respostaDoAsaas(e))
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
  const teste = a.tipo === 'clinica' && temDireitoAoTeste(plan.trialDays, jaTevePaga)
  const hoje = new Date()
  const vencimento = teste ? somarDias(hoje, plan.trialDays ?? 0) : hoje

  const service = asaas()
  let customer = customerId
  if (!customer) {
    try {
      customer = (await garantirClienteAsaas(service, user, a)).id
    } catch (e) {
      console.error('[Assinaturas] Asaas recusou o cliente:', respostaDoAsaas(e))
      throw erro(400, 'Não foi possível cadastrar seus dados no Asaas. Confira CPF/CNPJ, e-mail e celular do perfil.')
    }
  }

  let asaasSub: AsaasSubscription
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
  } catch (e) {
    console.error('[Assinaturas] Asaas recusou a assinatura:', respostaDoAsaas(e))
    throw erro(400, 'O Asaas recusou a criação da assinatura. Tente novamente em instantes.')
  }

  const sub = creating({
    ...donoDaAssinatura(a),
    planId: plan.id,
    asaasSubscriptionId: asaasSub.id,
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
export async function contratarPlano(user: CurrentUser, planCode: unknown, asaas: AsaasFactory, confirmacao?: ConfirmacaoContratacao) {
  const a = exigirAssinante(user)
  await exigirSemCancelamento(a)
  const plan = await planoContratavel(planCode, a)
  conferirConfirmacao(plan, confirmacao)

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

/** Persiste o pedido e tenta conciliá-lo; só a confirmação permite encerrar e rebaixar. */
export async function cancelarAssinaturas(a: Assinante, asaas: AsaasFactory) {
  const ids = await prisma.$transaction(async tx => {
    await bloquearAssinante(tx, a)
    const abertas = await tx.subscription.findMany({ where: { ...assinaturasDo(a), status: { notIn: ['canceled', 'expired'] } } })
    if (abertas.length === 0) throw erro(400, 'Nenhuma assinatura ativa encontrada.')
    for (const sub of abertas) await solicitarCancelamento(tx, sub, 'usuario')
    return abertas.map(sub => sub.id)
  })
  await conciliarCancelamentos(asaas, ids)
  const pendente = await prisma.asaasCancelamento.count({ where: { subscriptionId: { in: ids }, concluidoEm: null } })
  return { cancelamentoPendente: pendente > 0, message: pendente > 0 ? 'Cancelamento solicitado. A assinatura ainda aguarda confirmação do Asaas; tentaremos novamente automaticamente.' : 'Assinatura cancelada com sucesso.' }
}

/**
 * PATCH /api/assinaturas/:id/upgrade. Plano pago: nova assinatura `pending` (sem teste); a atual segue
 * valendo até o pagamento ser confirmado. `none` ou plano gratuito: cancela.
 */
export async function trocarPlano(user: CurrentUser, subId: string, planCode: unknown, asaas: AsaasFactory, confirmacao?: ConfirmacaoContratacao) {
  const a = exigirAssinante(user)
  if (!planCode || typeof planCode !== 'string') throw erro(400, 'planCode é obrigatório')

  const atual = await prisma.subscription.findUnique({ where: { id: subId } })
  const dono = atual && assinanteDaAssinatura(atual)
  if (!atual || dono?.tipo !== a.tipo || dono.id !== a.id) throw erro(404, 'Assinatura não encontrada')

  if (planCode === 'none' || planCode === a.planoPadrao) {
    const resultado = await cancelarAssinaturas(a, asaas)
    return { ...resultado, subscription: null, checkoutUrl: null, emTeste: false, primeiraFatura: null }
  }

  const plan = await planoContratavel(planCode, a)
  conferirConfirmacao(plan, confirmacao)
  if (plan.priceCents === 0) {
    const resultado = await cancelarAssinaturas(a, asaas)
    return { ...resultado, subscription: null, checkoutUrl: null, emTeste: false, primeiraFatura: null }
  }
  await exigirSemCancelamento(a)
  if (plan.code === a.planoAtual && atual.status === 'active') throw erro(400, 'Este já é o seu plano atual.')

  const pendentes = await prisma.subscription.findMany({ where: { ...assinaturasDo(a), status: 'pending' } })
  if (pendentes.length > 0) {
    await prisma.$transaction(async tx => {
      for (const p of pendentes) await solicitarCancelamento(tx, p, 'troca')
    })
    await conciliarCancelamentos(asaas, pendentes.map(p => p.id))
    await exigirSemCancelamento(a)
  }

  const r = await assinarNoAsaas(user, a, plan, asaas, atual.asaasCustomerId)
  return {
    message: r.emTeste
      ? 'Plano ativado no período de teste.'
      : 'Conclua o pagamento da fatura para ativar o novo plano.',
    ...r,
  }
}
