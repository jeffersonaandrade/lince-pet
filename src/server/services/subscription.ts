import 'server-only'
import { prisma } from '../db'
import { updating } from '../lucid'
import { PLANOS_POR_TIPO } from './assinatura-regras'
import { codigoPlanoIndividual, limitePlanoIndividual } from '@/lib/freemium'
import { usoAtualVeterinario } from './cotas-veterinario'
import { usoMensalPrestador } from './cotas-prestador'

type VetUsage = {
  id: string
  subscriptionPlanCode: string | null
  monthlyAppointmentsUsed: number | null
  monthlyAppointmentsResetAt: Date | null
}

type ComPlano = Pick<VetUsage, 'subscriptionPlanCode'>

/** Quem tem plano e contador mensal: veterinário ou prestador (mesmas colunas). */
export type DonoDoLimite = 'veterinario' | 'prestador'

const findPlan = (vet: ComPlano) =>
  prisma.subscriptionPlan.findUnique({ where: { code: vet.subscriptionPlanCode || 'free' } })

/** Catálogo contratável; códigos legados continuam válidos para acessos existentes. */
export async function listarPlanosAtivos(tipo?: keyof typeof PLANOS_POR_TIPO) {
  const planos = await prisma.subscriptionPlan.findMany({
    where: { active: 1, code: { in: tipo ? PLANOS_POR_TIPO[tipo] : [...new Set(Object.values(PLANOS_POR_TIPO).flat())] } },
    orderBy: [{ searchPriority: 'asc' }, { priceCents: 'asc' }],
  })
  return planos.map(plano => ['free', 'pro', 'pro_plus', 'vet_starter', 'vet_pro'].includes(plano.code) ? { ...plano, trialDays: 0 } : plano)
}

const saveUsage = (vet: VetUsage, data: Partial<VetUsage>, dono: DonoDoLimite = 'veterinario') => {
  Object.assign(vet, data)
  const where = { id: vet.id }
  return dono === 'prestador'
    ? prisma.prestador.update({ where, data: updating(data) })
    : prisma.veterinario.update({ where, data: updating(data) })
}

/** Reseta o contador mensal se o mês virou (muta `vet` como o model do Lucid). */
export async function resetMonthlyCounterIfNeeded(vet: VetUsage, dono: DonoDoLimite = 'veterinario') {
  const now = new Date()
  const last = vet.monthlyAppointmentsResetAt
  if (!last || last.getMonth() !== now.getMonth() || last.getFullYear() !== now.getFullYear()) {
    await saveUsage(vet, { monthlyAppointmentsUsed: 0, monthlyAppointmentsResetAt: now }, dono)
  }
}

export async function canCreateAppointment(
  vet: VetUsage,
  dono: DonoDoLimite = 'veterinario'
): Promise<{ allowed: boolean; reason?: string; limit?: number; used?: number }> {
  const codigo = codigoPlanoIndividual(vet.subscriptionPlanCode)
  const plan = await prisma.subscriptionPlan.findUnique({ where: { code: codigo } })
  if (!plan) return { allowed: false, reason: 'Plano não encontrado' }
  const limit = limitePlanoIndividual(codigo, plan.monthlyAppointmentLimit)
  if (limit === null) return { allowed: true }
  const used = dono === 'veterinario' ? await usoAtualVeterinario(vet.id) : await usoMensalPrestador(prisma, vet.id)
  if (used >= limit) {
    return {
      allowed: false,
      reason: 'Limite mensal atingido',
      limit,
      used,
    }
  }
  return { allowed: true }
}

export async function incrementUsage(vet: VetUsage, dono: DonoDoLimite = 'veterinario') {
  await saveUsage(vet, { monthlyAppointmentsUsed: (vet.monthlyAppointmentsUsed ?? 0) + 1 }, dono)
}

export async function decrementUsage(vet: VetUsage, dono: DonoDoLimite = 'veterinario') {
  if ((vet.monthlyAppointmentsUsed ?? 0) > 0) {
    await saveUsage(vet, { monthlyAppointmentsUsed: (vet.monthlyAppointmentsUsed ?? 0) - 1 }, dono)
  }
}

/** Aceita veterinário ou clínica (ambos têm subscriptionPlanCode). */
export async function hasFeature(vet: ComPlano, featureName: string) {
  const plan = await findPlan(vet)
  if (!plan?.features) return false
  try {
    const features = typeof plan.features === 'string' ? JSON.parse(plan.features) : plan.features
    return Array.isArray(features) && features.includes(featureName)
  } catch {
    return false
  }
}
