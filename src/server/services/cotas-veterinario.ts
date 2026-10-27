import 'server-only'
import type { Prisma } from '@/generated/prisma/client'
import { prisma } from '../db'
import { HttpError } from '../http'
import { updating } from '../lucid'
import { bloquearAssinante } from './assinante'
import { mesDaCota } from './cotas-prestador'
import { codigoPlanoIndividual, limitePlanoIndividual } from '@/lib/freemium'

type Leitura = { agendamento: Pick<Prisma.TransactionClient['agendamento'], 'count'> }
export const usoMensalVeterinario = (db: Leitura, veterinarioId: string, agora = new Date()) =>
  db.agendamento.count({ where: { veterinarioId, cotaConsumidaEm: mesDaCota(agora), cotaLiberadaEm: null } })

/** Chamada dentro da transação da reserva, depois da trava da agenda. */
export async function consumirCotaVeterinario(tx: Prisma.TransactionClient, veterinarioId: string, agendamentoId: string) {
  await bloquearAssinante(tx, { tipo: 'veterinario', id: veterinarioId })
  const vet = await tx.veterinario.findUniqueOrThrow({ where: { id: veterinarioId } })
  const codigo = codigoPlanoIndividual(vet.subscriptionPlanCode)
  const plano = await tx.subscriptionPlan.findUnique({ where: { code: codigo } })
  if (!plano) throw new HttpError(403, { message: 'Plano não encontrado.' })
  const agora = new Date(Math.floor(Date.now() / 1000) * 1000)
  const usados = await usoMensalVeterinario(tx, veterinarioId, agora)
  const limite = limitePlanoIndividual(codigo, plano.monthlyAppointmentLimit)
  if (limite !== null && usados >= limite) throw new HttpError(403, { message: 'Limite mensal de agendamentos atingido. Contrate um plano ou aguarde o próximo mês.' })
  await tx.agendamento.update({ where: { id: agendamentoId }, data: { cotaConsumidaEm: agora, cotaLiberadaEm: null } })
  await tx.veterinario.update({ where: { id: veterinarioId }, data: updating({ monthlyAppointmentsUsed: usados + 1, monthlyAppointmentsResetAt: agora }) })
}

/** Libera uma única vez e nunca devolve uma reserva já iniciada. */
export async function liberarCotasVeterinario(tx: Prisma.TransactionClient, veterinarioId: string, ids: string[]) {
  await bloquearAssinante(tx, { tipo: 'veterinario', id: veterinarioId })
  const agora = new Date()
  await tx.agendamento.updateMany({ where: { id: { in: ids }, veterinarioId, startedAt: null, cotaConsumidaEm: { not: null }, cotaLiberadaEm: null }, data: { cotaLiberadaEm: agora } })
  const usados = await usoMensalVeterinario(tx, veterinarioId, agora)
  await tx.veterinario.update({ where: { id: veterinarioId }, data: updating({ monthlyAppointmentsUsed: usados, monthlyAppointmentsResetAt: agora }) })
}

export const usoAtualVeterinario = (id: string) => usoMensalVeterinario(prisma, id)
