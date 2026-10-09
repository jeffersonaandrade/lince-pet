import 'server-only'
import { after } from 'next/server'
import { DateTime } from 'luxon'
import vine from '@vinejs/vine'
import type { BloqueioAgenda } from '@prisma/client'
import { prisma } from '../db'
import { HttpError } from '../http'
import { creating, updating } from '../lucid'
import { inAppNotifications } from './in-app-notifications'
import { notifications } from './notifications'
import { nomeCompleto, prepareDateTimeString } from './agendamentos'
import { notificarAgendamento } from './whatsapp-notificacoes'

/**
 * Bloqueio da agenda do veterinário. Não altera a grade semanal (horarios_funcionamento / horarios_online).
 * - Pontual: vale de `dataInicio` a `dataFim`.
 * - Recorrente: vale nos `diasSemana` (0=domingo) a partir de `dataInicio`, até `dataFim` (null = sem fim).
 * `horarios` null = dia inteiro.
 */

export const MOTIVO_CANCELAMENTO_BLOQUEIO = 'Agenda bloqueada pelo profissional'
const MAX_DIAS_PERIODO = 31
const STATUS_ATIVOS = ['pendente', 'confirmado']

type BloqueioLike = Pick<BloqueioAgenda, 'dataInicio' | 'dataFim' | 'horarios'> &
  Partial<Pick<BloqueioAgenda, 'recorrente' | 'diasSemana'>>

export const normalizarHorario = (horario: string | null | undefined) => (horario || '').trim().slice(0, 5)

export function horariosDoBloqueio(bloqueio: BloqueioLike): string[] | null {
  if (!Array.isArray(bloqueio.horarios)) return null
  return (bloqueio.horarios as unknown[]).filter((h): h is string => typeof h === 'string').map(normalizarHorario)
}

export function diasSemanaDoBloqueio(bloqueio: BloqueioLike): number[] {
  if (!Array.isArray(bloqueio.diasSemana)) return []
  return (bloqueio.diasSemana as unknown[]).map(Number).filter((d) => Number.isInteger(d) && d >= 0 && d <= 6)
}

/** Dia da semana (0=domingo) de uma data YYYY-MM-DD, sem depender do fuso do servidor. */
export const diaDaSemana = (data: string) => {
  const [y, m, d] = data.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay()
}

export function bloqueioCobreData(bloqueio: BloqueioLike, data: string) {
  if (data < bloqueio.dataInicio) return false
  if (bloqueio.dataFim && data > bloqueio.dataFim) return false
  if (bloqueio.recorrente) return diasSemanaDoBloqueio(bloqueio).includes(diaDaSemana(data))
  return true
}

export function diaInteiroBloqueado(bloqueios: BloqueioLike[], data: string) {
  return bloqueios.some((b) => bloqueioCobreData(b, data) && horariosDoBloqueio(b) === null)
}

/** Horários específicos bloqueados na data (não inclui bloqueios de dia inteiro). */
export function horariosBloqueadosNaData(bloqueios: BloqueioLike[], data: string) {
  const set = new Set<string>()
  for (const b of bloqueios) {
    if (!bloqueioCobreData(b, data)) continue
    horariosDoBloqueio(b)?.forEach((h) => set.add(h))
  }
  return [...set].sort()
}

export function isHorarioBloqueado(bloqueios: BloqueioLike[], data: string, horario: string) {
  if (diaInteiroBloqueado(bloqueios, data)) return true
  return horariosBloqueadosNaData(bloqueios, data).includes(normalizarHorario(horario))
}

/* ------------------------------------------------------------------ */

const isoDate = () => vine.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/)

const bloqueioValidator = vine.compile(
  vine.object({
    data_inicio: isoDate(),
    data_fim: isoDate().optional().nullable(),
    recorrente: vine.boolean().optional(),
    dias_semana: vine.array(vine.number().withoutDecimals().min(0).max(6)).minLength(1).optional().nullable(),
    horarios: vine.array(vine.string().trim().regex(/^\d{2}:\d{2}$/)).minLength(1).optional().nullable(),
    motivo: vine.string().trim().maxLength(255).optional().nullable(),
  })
)

export type BloqueioInput = {
  dataInicio: string
  dataFim: string | null
  recorrente: boolean
  diasSemana: number[] | null
  horarios: string[] | null
  motivo: string | null
}

const invalid = (message: string) => new HttpError(422, { status: 422, message })

export async function validarBloqueio(body: unknown): Promise<BloqueioInput> {
  const data = await bloqueioValidator.validate(body)
  const recorrente = Boolean(data.recorrente)
  const inicio = DateTime.fromISO(data.data_inicio)
  const fimRaw = data.data_fim || (recorrente ? null : data.data_inicio)
  const fim = fimRaw ? DateTime.fromISO(fimRaw) : null

  if (!inicio.isValid || (fim && !fim.isValid)) throw invalid('Data inválida')
  if (fim && fim < inicio) throw invalid('A data final deve ser igual ou posterior à data inicial')
  if (inicio < DateTime.now().startOf('day')) throw invalid('Não é possível bloquear datas passadas')
  if (!recorrente && fim && fim.diff(inicio, 'days').days + 1 > MAX_DIAS_PERIODO) {
    throw invalid(`O período de bloqueio pode ter no máximo ${MAX_DIAS_PERIODO} dias`)
  }

  const diasSemana = recorrente
    ? [...new Set(data.dias_semana?.length ? data.dias_semana : [diaDaSemana(inicio.toISODate()!)])].sort()
    : null

  return {
    dataInicio: inicio.toISODate()!,
    dataFim: fim ? fim.toISODate()! : null,
    recorrente,
    diasSemana,
    horarios: data.horarios?.length ? [...new Set(data.horarios.map(normalizarHorario))].sort() : null,
    motivo: data.motivo || null,
  }
}

/* ------------------------------------------------------------------ */

/** Bloqueios (pontuais e recorrentes) que podem cobrir alguma data entre `de` e `ate`. */
export function bloqueiosDoPeriodo(veterinarioId: string, de: string, ate: string = de) {
  return prisma.bloqueioAgenda.findMany({
    where: {
      veterinarioId,
      dataInicio: { lte: ate },
      OR: [{ dataFim: null }, { dataFim: { gte: de } }],
    },
    orderBy: [{ dataInicio: 'asc' }, { createdAt: 'asc' }],
  })
}

export const MENSAGEM_HORARIO_BLOQUEADO = 'Horário indisponível. O profissional bloqueou a agenda neste horário.'

export async function horarioEstaBloqueado(veterinarioId: string, data: string, horario: string) {
  return isHorarioBloqueado(await bloqueiosDoPeriodo(veterinarioId, data), data, horario)
}

export async function buscarConflitos(veterinarioId: string, input: BloqueioInput) {
  const agendamentos = await prisma.agendamento.findMany({
    where: {
      veterinarioId,
      dataConsulta: input.dataFim ? { gte: input.dataInicio, lte: input.dataFim } : { gte: input.dataInicio },
      status: { in: STATUS_ATIVOS },
    },
    include: {
      tutor: { include: { user: { select: { id: true, nome: true, sobrenome: true, email: true } } } },
      pet: { select: { nome: true } },
    },
    orderBy: [{ dataConsulta: 'asc' }, { horarioConsulta: 'asc' }],
  })
  const bloqueio = { ...input, recorrente: input.recorrente ? 1 : 0 }
  return agendamentos.filter(
    (a) => a.dataConsulta && a.horarioConsulta && isHorarioBloqueado([bloqueio], a.dataConsulta, a.horarioConsulta)
  )
}

type Conflito = Awaited<ReturnType<typeof buscarConflitos>>[number]

export const serializeConflito = (a: Conflito) => ({
  id: a.id,
  data_consulta: a.dataConsulta,
  horario_consulta: a.horarioConsulta,
  status: a.status,
  tipo_consulta: a.tipoConsulta,
  tutor_nome: a.tutor?.user ? nomeCompleto(a.tutor.user) : null,
  pet_nome: a.pet?.nome || null,
  payment_status: a.paymentStatus,
})

export const serializeBloqueio = (b: BloqueioAgenda) => ({
  id: b.id,
  veterinario_id: b.veterinarioId,
  data_inicio: b.dataInicio,
  data_fim: b.dataFim,
  recorrente: Boolean(b.recorrente),
  dias_semana: b.recorrente ? diasSemanaDoBloqueio(b) : [],
  dia_inteiro: horariosDoBloqueio(b) === null,
  horarios: horariosDoBloqueio(b) || [],
  motivo: b.motivo,
  clinica_id: b.clinicaId,
  created_at: b.createdAt,
})

/**
 * Cria o bloqueio e cancela as consultas ativas que caem nele.
 * Com `preview`, só retorna os conflitos (nada é salvo).
 */
export async function criarBloqueio(
  veterinarioId: string,
  body: unknown,
  opts: { userId: string; clinicaId?: string | null; preview?: boolean }
) {
  const input = await validarBloqueio(body)
  const conflitos = await buscarConflitos(veterinarioId, input)

  if (opts.preview) return { bloqueio: null, conflitos: conflitos.map(serializeConflito) }

  const bloqueio = await prisma.$transaction(async (tx) => {
    const novo = await tx.bloqueioAgenda.create({
      data: creating({
        veterinarioId,
        dataInicio: input.dataInicio,
        dataFim: input.dataFim,
        recorrente: input.recorrente ? 1 : 0,
        diasSemana: input.diasSemana ?? undefined,
        horarios: input.horarios ?? undefined,
        motivo: input.motivo,
        criadoPorUserId: opts.userId,
        clinicaId: opts.clinicaId || null,
      }),
    })

    if (conflitos.length) {
      await tx.agendamento.updateMany({
        where: { id: { in: conflitos.map((c) => c.id) }, status: { in: STATUS_ATIVOS } },
        data: updating({
          status: 'cancelado',
          motivoCancelamento: MOTIVO_CANCELAMENTO_BLOQUEIO,
          canceladoEm: prepareDateTimeString(DateTime.now()),
        }),
      })

      const vet = await tx.veterinario.findUnique({ where: { id: veterinarioId } })
      if (vet && (vet.monthlyAppointmentsUsed ?? 0) > 0) {
        await tx.veterinario.update({
          where: { id: vet.id },
          data: updating({ monthlyAppointmentsUsed: Math.max((vet.monthlyAppointmentsUsed ?? 0) - conflitos.length, 0) }),
        })
      }
    }

    return novo
  })

  if (conflitos.length) after(() => notificarTutores(veterinarioId, conflitos, input.motivo))

  return { bloqueio: serializeBloqueio(bloqueio), conflitos: conflitos.map(serializeConflito) }
}

async function notificarTutores(veterinarioId: string, conflitos: Conflito[], motivo: string | null) {
  const vet = await prisma.veterinario.findUnique({ where: { id: veterinarioId }, include: { user: true } })
  const veterinarioNome = vet?.user ? nomeCompleto(vet.user) : 'Veterinário'

  for (const a of conflitos) {
    const tutorUser = a.tutor?.user
    if (!tutorUser) continue
    const data = a.dataConsulta ? DateTime.fromISO(a.dataConsulta).toFormat('dd/MM/yyyy') : ''
    try {
      await inAppNotifications.notifyAppointmentCancelledByAgendaBlockToTutor({
        tutorUserId: tutorUser.id,
        veterinarioNome,
        dataConsulta: data,
        horarioConsulta: a.horarioConsulta || '',
        agendamentoId: a.id,
      })
      await notifications.sendAppointmentCancellation(tutorUser.email, {
        nomeTutor: tutorUser.nome,
        nomeVeterinario: veterinarioNome,
        data,
        horario: a.horarioConsulta,
        motivo: motivo || MOTIVO_CANCELAMENTO_BLOQUEIO,
        isVeterinario: false,
      })
    } catch (error) {
      console.error('❌ [Bloqueio] Erro ao notificar tutor do cancelamento:', error)
    }
    await notificarAgendamento('cancelamento', a.id, ['tutor'], { motivo: motivo || MOTIVO_CANCELAMENTO_BLOQUEIO })
  }
}

/** Clínica só gerencia a agenda de veterinários com vínculo aceito. */
export async function assertVinculoAceito(clinicaId: string, veterinarioId: string) {
  const vinculo = await prisma.veterinarioClinica.findFirst({
    where: { clinicaId, veterinarioId, status: 'aceito' },
  })
  if (!vinculo) throw new HttpError(404, { message: 'Veterinário não vinculado à clínica' })
}

export function listarBloqueios(veterinarioId: string, de?: string, ate?: string) {
  return prisma.bloqueioAgenda.findMany({
    where: {
      veterinarioId,
      OR: [{ dataFim: null }, { dataFim: { gte: de || DateTime.now().toISODate()! } }],
      ...(ate ? { dataInicio: { lte: ate } } : {}),
    },
    orderBy: [{ dataInicio: 'asc' }, { createdAt: 'asc' }],
  })
}
