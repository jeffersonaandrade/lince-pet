import 'server-only'
import { randomUUID } from 'node:crypto'
import { DateTime } from 'luxon'
import { Prisma } from '@prisma/client'

/**
 * Comportamentos que o Lucid fazia automaticamente e o Prisma não faz
 * (o schema veio das migrations, sem @default(now()) / @updatedAt).
 */

export const uuid = () => randomUUID()

/** Colunas TIMESTAMP(0) arredondam milissegundos no MySQL; o Lucid truncava. */
export function now() {
  const date = new Date()
  date.setMilliseconds(0)
  return date
}

/** Equivalente a `@column.dateTime({ autoCreate: true, autoUpdate: true })` no create. */
export function creating<T extends object>(data: T, opts: { id?: boolean } = { id: true }) {
  const timestamp = now()
  return {
    ...(opts.id === false ? {} : { id: uuid() }),
    ...data,
    createdAt: timestamp,
    updatedAt: timestamp,
  } as T & { id: string; createdAt: Date; updatedAt: Date }
}

/** Equivalente ao autoUpdate do updatedAt. */
export function updating<T extends object>(data: T) {
  return { ...data, updatedAt: now() }
}

/** Serializa como o Lucid: DateTime -> ISO do Luxon (fuso do servidor), DECIMAL -> string com 2 casas. */
export function serialize(value: unknown): unknown {
  if (value === null || value === undefined) return value
  if (value instanceof Date) return DateTime.fromJSDate(value).toISO()
  if (DateTime.isDateTime(value)) return value.toISO()
  if (Prisma.Decimal.isDecimal(value)) return (value as Prisma.Decimal).toFixed(2)
  if (typeof value === 'bigint') return Number(value)
  if (Buffer.isBuffer(value)) return value.toString()
  if (Array.isArray(value)) return value.map(serialize)
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (v !== undefined) out[k] = serialize(v)
    }
    return out
  }
  return value
}

/** Mesmo formato do `paginator.toJSON()` do Lucid. */
export function paginate<T>(data: T[], total: number, page: number, perPage: number, baseUrl = '/') {
  const lastPage = Math.max(Math.ceil(total / perPage), 1)
  const url = (p: number) => `${baseUrl}?page=${p}`
  return {
    meta: {
      total,
      perPage,
      currentPage: page,
      lastPage,
      firstPage: 1,
      firstPageUrl: url(1),
      lastPageUrl: url(lastPage),
      nextPageUrl: page < lastPage ? url(page + 1) : null,
      previousPageUrl: page > 1 ? url(page - 1) : null,
    },
    data,
  }
}

export const pageParams = (rawPage: unknown, perPage: number) => {
  const page = Math.max(Number(rawPage) || 1, 1)
  return { page, perPage, skip: (page - 1) * perPage, take: perPage }
}

/** Converte DECIMAL do Prisma em number (para cálculos). */
export const toNumber = (value: Prisma.Decimal | number | string | null | undefined) =>
  value === null || value === undefined ? null : Number(value)
