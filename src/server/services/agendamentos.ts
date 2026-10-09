import 'server-only'
import { DateTime } from 'luxon'

/** `column.date` do Lucid: string do banco -> DateTime.fromSQL (null permanece null). */
export function consumeDataConsulta(value: string | null): DateTime | null {
  return value === null ? null : DateTime.fromSQL(value)
}

/** `column.date` do Lucid na escrita (lança como o Lucid para DateTime inválido). */
export function prepareDataConsulta(value: DateTime) {
  if (!value.isValid) throw new Error(`Invalid value for "Agendamento.dataConsulta". ${value.invalidReason}`)
  return value.toISODate()!
}

export const FUSO_CONSULTA = 'America/Sao_Paulo'

/** Data da consulta (YYYY-MM-DD...) + "HH:MM" interpretados em America/Sao_Paulo. */
export function inicioDaConsulta(dataConsulta: string, horarioConsulta: string): DateTime {
  const [year, month, day] = dataConsulta.slice(0, 10).split('-').map(Number)
  const [hour, minute] = horarioConsulta.split(':').map(Number)
  return DateTime.fromObject({ year, month, day, hour, minute }, { zone: FUSO_CONSULTA })
}

/** `column.dateTime` gravado em coluna VARCHAR (formato do dialeto MySQL). */
export const prepareDateTimeString = (value: DateTime) => value.toFormat('yyyy-MM-dd HH:mm:ss')

/** Equivalente a Agendamento.podeSerCancelado(). */
export function podeSerCancelado(status: string | null | undefined) {
  return ['pendente', 'confirmado', 'agendado', 'marcado'].includes(status?.toLowerCase() || '')
}

/** Equivalente a Agendamento.jaPassou(). */
export function jaPassou(dataConsulta: DateTime | null, horarioConsulta: string | null) {
  try {
    const agora = DateTime.now()
    const dataHoraConsulta = DateTime.fromJSDate(dataConsulta!.toJSDate()).set({
      hour: Number.parseInt(horarioConsulta!.split(':')[0]),
      minute: Number.parseInt(horarioConsulta!.split(':')[1]),
    })
    return dataHoraConsulta < agora
  } catch {
    return false
  }
}

export const nomeCompleto = (user: { nome: string; sobrenome: string | null }) =>
  `${user.nome} ${user.sobrenome ?? ''}`.trim()
