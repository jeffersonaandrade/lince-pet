import 'server-only'
import type { TipoServico } from '@prisma/client'
import { prisma, type Usuario } from '../db'
import { nomeCompleto } from './agendamentos'

/**
 * Quem atende o agendamento: veterinário (consulta) ou prestador (serviço). Avisos, e-mails e Google Agenda
 * usam isto para não espalhar `if (veterinario)` e para não tratar prestador como veterinário.
 */
export type Profissional = {
  tipo: 'veterinario' | 'prestador'
  user: Usuario | null
  nome: string
  /** "Veterinário" ou o nome do tipo de serviço ("Passeador", "Banho e tosa"...). */
  rotulo: string
  /** "consulta" ou "serviço", para os textos. */
  atendimento: 'consulta' | 'serviço'
}

type UserLike = Usuario | null | undefined

export type ComProfissional = {
  veterinario?: { user?: UserLike } | null
  prestador?: { user?: UserLike; tipoServico?: Pick<TipoServico, 'nome'> | null } | null
  clinica?: { nomeClinica?: string | null } | null
}

export function profissionalDe(a: ComProfissional): Profissional {
  if (a.prestador) {
    const user = a.prestador.user ?? null
    return {
      tipo: 'prestador',
      user,
      nome: user ? nomeCompleto(user) : 'Profissional',
      rotulo: a.prestador.tipoServico?.nome || 'Profissional pet',
      atendimento: 'serviço',
    }
  }
  const user = a.veterinario?.user ?? null
  return {
    tipo: 'veterinario',
    user,
    nome: user ? nomeCompleto(user) : a.clinica?.nomeClinica || 'Profissional',
    rotulo: 'Veterinário',
    atendimento: 'consulta',
  }
}

/** Carrega o profissional (com user) a partir dos ids do agendamento. */
export async function carregarProfissional(a: { veterinarioId: string | null; prestadorId?: string | null }) {
  const [veterinario, prestador] = await Promise.all([
    a.veterinarioId ? prisma.veterinario.findUnique({ where: { id: a.veterinarioId }, include: { user: true } }) : null,
    a.prestadorId
      ? prisma.prestador.findUnique({ where: { id: a.prestadorId }, include: { user: true, tipoServico: true } })
      : null,
  ])
  return profissionalDe({ veterinario, prestador })
}
