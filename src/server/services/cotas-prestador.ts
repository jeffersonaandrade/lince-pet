import 'server-only'
import { DateTime } from 'luxon'
import type { Prisma } from '@/generated/prisma/client'
import { HttpError } from '../http'
import { updating } from '../lucid'
import { bloquearAssinante } from './assinante'
import { FUSO_CONSULTA } from './agendamentos'
import { codigoPlanoIndividual, limitePlanoIndividual } from '@/lib/freemium'

export const MAX_PENDENTES_POR_TUTOR = 3
export function mesDaCota(agora = new Date()) {
  const inicio = DateTime.fromJSDate(agora).setZone(FUSO_CONSULTA).startOf('month')
  return { gte: inicio.toUTC().toJSDate(), lt: inicio.plus({ months: 1 }).toUTC().toJSDate() }
}
export async function usoMensalPrestador(db: { agendamento: Pick<Prisma.TransactionClient['agendamento'], 'count'> }, prestadorId: string, agora = new Date()) {
  return db.agendamento.count({ where: { prestadorId, cotaConsumidaEm: mesDaCota(agora), cotaLiberadaEm: null } })
}
/** Agenda já travada; assinatura também trava para serializar upgrades/webhooks. */
export async function consumirCota(db: Prisma.TransactionClient, prestadorId: string, pedidoId: string) {
  await bloquearAssinante(db, { tipo: 'prestador', id: prestadorId })
  const prestador = await db.prestador.findUniqueOrThrow({ where: { id: prestadorId } })
  const codigo = codigoPlanoIndividual(prestador.subscriptionPlanCode)
  const plano = await db.subscriptionPlan.findUnique({ where: { code: codigo } })
  if (!plano) throw new HttpError(403, { message: 'Plano não encontrado' })
  const agora = new Date(Math.floor(Date.now() / 1000) * 1000)
  const usados = await usoMensalPrestador(db, prestadorId, agora)
  const limite = limitePlanoIndividual(codigo, plano.monthlyAppointmentLimit)
  if (limite !== null && usados >= limite) {
    throw new HttpError(403, { message: 'Limite mensal de aceites atingido. Cancele um pedido ainda não iniciado ou altere seu plano.' })
  }
  await db.agendamento.update({ where: { id: pedidoId }, data: { cotaConsumidaEm: agora, cotaLiberadaEm: null } })
  await db.prestador.update({ where: { id: prestadorId }, data: updating({ monthlyAppointmentsUsed: usados + 1, monthlyAppointmentsResetAt: agora }) })
}
/** Registros de consumo impedem devolver ao mês atual uma unidade de outro mês. */
export async function liberarCota(db: Prisma.TransactionClient, prestadorId: string, pedidoId: string) {
  await bloquearAssinante(db, { tipo: 'prestador', id: prestadorId })
  const agora = new Date()
  await db.agendamento.updateMany({ where: { id: pedidoId, prestadorId, startedAt: null, cotaConsumidaEm: { not: null }, cotaLiberadaEm: null }, data: { cotaLiberadaEm: agora } })
  const usados = await usoMensalPrestador(db, prestadorId, agora)
  await db.prestador.update({ where: { id: prestadorId }, data: updating({ monthlyAppointmentsUsed: usados, monthlyAppointmentsResetAt: agora }) })
}
export async function conferirPendentes(db: Prisma.TransactionClient, prestadorId: string, tutorId: string, ignorarId?: string) {
  const quantidade = await db.agendamento.count({ where: { prestadorId, tutorId, status: 'pendente', ...(ignorarId ? { id: { not: ignorarId } } : {}) } })
  if (quantidade >= MAX_PENDENTES_POR_TUTOR) throw new HttpError(409, { message: 'Você já tem 3 pedidos pendentes para este profissional. Aguarde a resposta ou cancele um deles.' })
}
