import 'server-only'
import { DateTime } from 'luxon'
import type { Agendamento, Avaliacao, Pet, Tutor, User } from '@prisma/client'
import { prisma } from '../db'

type AvaliacaoComRelacoes = Avaliacao & {
  tutor: (Tutor & { user: Pick<User, 'nome' | 'sobrenome'> | null }) | null
  agendamento: (Agendamento & { pet?: Pet | null }) | null
}

/** `@column.date` do Lucid: string -> DateTime.fromSQL (inválida vira 'Invalid DateTime' no toFormat). */
function formatDataConsulta(value: string | Date | null) {
  if (!value) return null
  const date = typeof value === 'string' ? DateTime.fromSQL(value) : DateTime.fromJSDate(value)
  return date.toFormat('dd/MM/yyyy')
}

const tutorResumo = (a: AvaliacaoComRelacoes) =>
  a.tutor?.user ? { nome: a.tutor.user.nome, sobrenome: a.tutor.user.sobrenome ?? null } : null

const petResumo = (a: AvaliacaoComRelacoes) =>
  a.agendamento?.pet ? { nome: a.agendamento.pet.nome, foto_url: a.agendamento.pet.fotoUrl ?? null } : null

const quando = (a: AvaliacaoComRelacoes) => ({
  data: formatDataConsulta(a.agendamento?.dataConsulta ?? null),
  hora: a.agendamento?.horarioConsulta || null,
})

export const media = (valores: Array<number | null>) => {
  const soma = valores.reduce<number>((acc, v) => acc + (v || 0), 0)
  return Number((valores.length ? soma / valores.length : 0).toFixed(2))
}

export async function listarAvaliacoes(
  where: { veterinarioId: string } | { clinicaId: string },
  options: { comPet?: boolean; limit?: number } = {}
) {
  const porClinica = 'clinicaId' in where
  return prisma.avaliacao.findMany({
    where: porClinica ? { clinicaId: where.clinicaId, estrelasClinica: { not: null } } : where,
    include: {
      tutor: { include: { user: true } },
      agendamento: options.comPet ? { include: { pet: true } } : true,
    },
    orderBy: { createdAt: 'desc' },
    take: options.limit,
  })
}

export function serializarVeterinario(a: AvaliacaoComRelacoes, comPet = false) {
  return {
    id: a.id,
    estrelas: a.estrelas,
    comentario: a.comentario,
    ...quando(a),
    tutor: tutorResumo(a),
    ...(comPet ? { pet: petResumo(a) } : {}),
  }
}

export function serializarClinica(a: AvaliacaoComRelacoes, comPet = false) {
  return {
    id: a.id,
    estrelasClinica: a.estrelasClinica,
    comentarioClinica: a.comentarioClinica,
    ...quando(a),
    tutor: tutorResumo(a),
    ...(comPet ? { pet: petResumo(a) } : {}),
  }
}
