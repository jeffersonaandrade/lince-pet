import 'server-only'
import { DateTime } from 'luxon'
import type { BloqueioAgenda, Prisma, Veterinario } from '@/generated/prisma/client'
import { prisma } from '../db'
import { HttpError } from '../http'
import { FUSO_CONSULTA, inicioDaConsulta } from './agendamentos'
import { normalizarGrade, DIAS_SEMANA } from '@/lib/horarios'
import { intervalosConflitam, modalidadeConsulta, STATUS_RESERVAM_AGENDA, type IntervaloAgenda, type ModalidadeConsulta } from '@/domain/agenda'
import { bloqueioCobreData, horariosDoBloqueio } from './bloqueios'

type Db = Prisma.TransactionClient | typeof prisma
type Dono = { id: string; userId?: string | null; tipo: 'veterinario' | 'prestador' }
type Reserva = { id: string; dataConsulta: string | null; horarioConsulta: string | null; inicioEm: Date | null; fimEm: Date | null; duracaoMin?: number; deslocamentoMin?: number }
export const ERRO_CONFLITO_AGENDA = 'Horário indisponível: há atendimento ou deslocamento reservado em um dos seus perfis profissionais.'
const falha = (message: string, status = 400) => new HttpError(status, { message })

export function intervaloDaReserva(r: Reserva): IntervaloAgenda | null {
  const inicio = r.inicioEm ? DateTime.fromJSDate(r.inicioEm, { zone: FUSO_CONSULTA })
    : r.dataConsulta && r.horarioConsulta ? inicioDaConsulta(r.dataConsulta, r.horarioConsulta) : null
  if (!inicio?.isValid) return null
  return { inicio: inicio.toMillis(), fim: r.fimEm?.getTime() ?? inicio.plus({ minutes: r.duracaoMin ?? 30 }).toMillis(), deslocamentoMin: r.deslocamentoMin ?? 0 }
}

export async function ocupacoesDaPessoa(db: Db, dono: Dono, inicio: DateTime, fim: DateTime, ignorarId?: string) {
  const de = inicio.minus({ minutes: 240 }).startOf('day')
  const ate = fim.plus({ minutes: 240 }).endOf('day')
  return db.agendamento.findMany({
    where: {
      ...(ignorarId ? { id: { not: ignorarId } } : {}),
      status: { in: STATUS_RESERVAM_AGENDA },
      AND: [
        dono.userId ? { OR: [{ veterinario: { userId: dono.userId } }, { prestador: { userId: dono.userId } }] }
          : dono.tipo === 'veterinario' ? { veterinarioId: dono.id } : { prestadorId: dono.id },
        { OR: [
          { inicioEm: { lte: ate.toJSDate() }, fimEm: { gte: de.toJSDate() } },
          { inicioEm: null, dataConsulta: { gte: de.toISODate()!, lte: ate.toISODate()! } },
        ] },
      ],
    },
    select: { id: true, dataConsulta: true, horarioConsulta: true, inicioEm: true, fimEm: true, duracaoMin: true, deslocamentoMin: true },
  })
}

export async function conferirAgendaDaPessoa(db: Db, dono: Dono, inicio: DateTime, fim: DateTime, deslocamentoMin = 0, ignorarId?: string) {
  const reservas = await ocupacoesDaPessoa(db, dono, inicio, fim, ignorarId)
  const candidato = { inicio: inicio.toMillis(), fim: fim.toMillis(), deslocamentoMin }
  if (reservas.some(r => { const periodo = intervaloDaReserva(r); return periodo && intervalosConflitam(candidato, periodo) })) throw falha(ERRO_CONFLITO_AGENDA, 409)
}

export function periodoDaConsulta(vet: Veterinario, data: string, horario: string, tipo: ModalidadeConsulta, duracaoAnterior?: number) {
  const inicio = inicioDaConsulta(data, horario)
  if (!inicio.isValid) throw falha('Data ou horário inválido.')
  const duracaoMin = duracaoAnterior ?? (tipo === 'domicilio' ? vet.duracaoDomicilioMin ?? 60 : tipo === 'online' ? vet.duracaoOnlineMin ?? 30 : vet.duracaoPresencialMin ?? 30)
  const deslocamentoMin = tipo === 'domicilio' ? vet.deslocamentoMin ?? 40 : 0
  const fim = inicio.plus({ minutes: duracaoMin })
  return { inicio, fim, duracaoMin, deslocamentoMin }
}

/** Cada horário cadastrado representa um bloco de 30 min de atendimento. */
export function cabeNaGrade(gradeBruta: unknown, inicio: DateTime, fim: DateTime) {
  if (!inicio.hasSame(fim.minus({ milliseconds: 1 }), 'day')) return false
  const grade = normalizarGrade(gradeBruta)
  const horarios = new Set(grade[DIAS_SEMANA[inicio.weekday % 7]] ?? [])
  for (let t = inicio; t < fim; t = t.plus({ minutes: 30 })) if (!horarios.has(t.toFormat('HH:mm'))) return false
  return true
}

export async function conferirConsultaVeterinaria(db: Db, vet: Veterinario, data: string, horario: string, tipoBruto: unknown, enderecoId?: string | null, ignorarId?: string, duracaoAnterior?: number) {
  const tipo = modalidadeConsulta(tipoBruto)
  if (!tipo) throw falha('Modalidade de consulta inválida.')
  const periodo = periodoDaConsulta(vet, data, horario, tipo, duracaoAnterior)
  if (periodo.inicio <= DateTime.now()) throw falha('Não é possível reservar um horário que já passou.')
  const { inicio, fim, deslocamentoMin } = periodo
  let veterinarioEnderecoId: string | null = null
  if (tipo === 'domicilio') {
    if (!vet.atendeDomicilio) throw falha('Este veterinário não atende a domicílio.')
    if (!cabeNaGrade(vet.horariosDomicilio, inicio, fim)) throw falha('Atendimento fora da grade domiciliar do veterinário.')
  } else if (tipo === 'online') {
    if (!vet.atendeOnline || !cabeNaGrade(vet.horariosOnline, inicio, fim)) throw falha('Atendimento fora da grade de teleconsulta.')
  } else {
    if (!vet.atendePresencial) throw falha('Este veterinário não atende presencialmente.')
    const enderecos = await db.veterinarioEndereco.findMany({ where: { veterinarioId: vet.id, ativo: 1, ...(enderecoId ? { id: enderecoId } : {}) } })
    const endereco = enderecos.find(e => cabeNaGrade(e.horariosDisponibilidade, inicio, fim))
    if (!endereco) throw falha('Atendimento fora da grade presencial do veterinário.')
    veterinarioEnderecoId = endereco.id
  }
  const de = inicio.minus({ minutes: deslocamentoMin })
  const ate = fim.plus({ minutes: deslocamentoMin })
  const bloqueios = await db.bloqueioAgenda.findMany({ where: { veterinarioId: vet.id } })
  // Deslocamento também não pode ocupar almoço, folgas ou bloqueios manuais.
  const bloqueado = consultaBloqueada(bloqueios, de, ate)
  if (bloqueado) throw falha('Horário indisponível: atendimento ou deslocamento atingem um bloqueio da agenda.')
  await conferirAgendaDaPessoa(db, { id: vet.id, userId: vet.userId, tipo: 'veterinario' }, inicio, fim, deslocamentoMin, ignorarId)
  return { ...periodo, veterinarioEnderecoId }
}

export function consultaBloqueada(bloqueios: BloqueioAgenda[], de: DateTime, ate: DateTime) {
  return bloqueios.some(b => {
    for (let dia = de.startOf('day'); dia < ate; dia = dia.plus({ days: 1 })) {
      if (!bloqueioCobreData(b, dia.toISODate()!)) continue
      const horas = horariosDoBloqueio(b)
      if (horas === null) return true
      if (horas.some(h => {
        const inicioBloqueio = inicioDaConsulta(dia.toISODate()!, h).toMillis()
        return de.toMillis() < inicioBloqueio + 3_600_000 && ate.toMillis() > inicioBloqueio
      })) return true
    }
    return false
  })
}

export function camposDaConsulta(p: ReturnType<typeof periodoDaConsulta> & { veterinarioEnderecoId?: string | null }) {
  return { inicioEm: p.inicio.toJSDate(), fimEm: p.fim.toJSDate(), duracaoMin: p.duracaoMin, deslocamentoMin: p.deslocamentoMin, veterinarioEnderecoId: p.veterinarioEnderecoId ?? null }
}
