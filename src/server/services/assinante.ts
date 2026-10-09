import 'server-only'
import type { Prisma } from '@prisma/client'
import type { CurrentUser } from '../auth/session'
import { updating } from '../lucid'
import type { AsaasService } from './asaas'

type Db = Prisma.TransactionClient

export type TipoAssinante = 'veterinario' | 'clinica' | 'prestador'

/** Quem paga a assinatura: veterinário, clínica ou prestador, com o plano de volta em caso de cancelamento. */
export type Assinante = {
  tipo: TipoAssinante
  id: string
  planoAtual: string | null
  planoPadrao: string
  usado: number
}

export const PLANO_PADRAO: Record<TipoAssinante, string> = {
  veterinario: 'none',
  clinica: 'none',
  prestador: 'free',
}

export function assinanteDe(user: CurrentUser): Assinante | null {
  const base = (tipo: TipoAssinante, e: { id: string; subscriptionPlanCode: string | null }, usado = 0): Assinante => ({
    tipo,
    id: e.id,
    planoAtual: e.subscriptionPlanCode,
    planoPadrao: PLANO_PADRAO[tipo],
    usado,
  })
  if (user.userType === 'veterinario' && user.veterinario)
    return base('veterinario', user.veterinario, user.veterinario.monthlyAppointmentsUsed ?? 0)
  if (user.userType === 'clinica' && user.clinica) return base('clinica', user.clinica)
  if (user.userType === 'prestador' && user.prestador)
    return base('prestador', user.prestador, user.prestador.monthlyAppointmentsUsed ?? 0)
  return null
}

/** Colunas de dono em `Subscription` (uma preenchida, as outras null). */
export const donoDaAssinatura = (a: Pick<Assinante, 'tipo' | 'id'>) => ({
  veterinarioId: a.tipo === 'veterinario' ? a.id : null,
  clinicaId: a.tipo === 'clinica' ? a.id : null,
  prestadorId: a.tipo === 'prestador' ? a.id : null,
})

/** Filtro de assinaturas do dono. */
export const assinaturasDo = (a: Pick<Assinante, 'tipo' | 'id'>) =>
  a.tipo === 'veterinario' ? { veterinarioId: a.id } : a.tipo === 'clinica' ? { clinicaId: a.id } : { prestadorId: a.id }

export const referenciaExterna = (a: Pick<Assinante, 'tipo' | 'id'>) =>
  `${a.tipo === 'veterinario' ? 'vet' : a.tipo}:${a.id}`

/** Assinante dono de uma assinatura local (para o webhook). */
export function assinanteDaAssinatura(sub: {
  veterinarioId: string | null
  clinicaId: string | null
  prestadorId: string | null
}): Pick<Assinante, 'tipo' | 'id'> | null {
  if (sub.veterinarioId) return { tipo: 'veterinario', id: sub.veterinarioId }
  if (sub.clinicaId) return { tipo: 'clinica', id: sub.clinicaId }
  if (sub.prestadorId) return { tipo: 'prestador', id: sub.prestadorId }
  return null
}

/** Troca o plano; quem tem limite mensal (veterinário e prestador) zera o contador, salvo `zerarContador: false`. */
export async function definirPlano(db: Db, a: Pick<Assinante, 'tipo' | 'id'>, code: string, zerarContador = true) {
  const where = { id: a.id }
  const comContador = updating(
    zerarContador
      ? { subscriptionPlanCode: code, monthlyAppointmentsUsed: 0, monthlyAppointmentsResetAt: new Date() }
      : { subscriptionPlanCode: code }
  )
  if (a.tipo === 'veterinario') return db.veterinario.update({ where, data: comContador })
  if (a.tipo === 'prestador') return db.prestador.update({ where, data: comContador })
  return db.clinica.update({ where, data: updating({ subscriptionPlanCode: code }) })
}

export async function planoAtualDe(db: Db, a: Pick<Assinante, 'tipo' | 'id'>) {
  const where = { id: a.id }
  const select = { subscriptionPlanCode: true }
  const e =
    a.tipo === 'veterinario'
      ? await db.veterinario.findUnique({ where, select })
      : a.tipo === 'prestador'
        ? await db.prestador.findUnique({ where, select })
        : await db.clinica.findUnique({ where, select })
  return e ? e.subscriptionPlanCode : undefined
}

export function garantirClienteAsaas(service: AsaasService, user: CurrentUser, a: Assinante) {
  if (a.tipo === 'veterinario') return service.ensureCustomerForVeterinario(user, user.veterinario!)
  if (a.tipo === 'prestador') return service.ensureCustomerForPrestador(user, user.prestador!)
  return service.ensureCustomerForClinica(user, user.clinica!)
}
