import 'server-only'
import type { Prisma } from '@/generated/prisma/client'

/** A mesma chave deve proteger a consulta e a escrita, em todas as instâncias. */
export async function bloquearAgenda(tx: Prisma.TransactionClient, tipo: 'veterinario' | 'prestador', id: string) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(COALESCE(
    CASE WHEN ${tipo} = 'veterinario'
      THEN (SELECT 'agenda:pessoa:' || user_id FROM veterinarios WHERE id = ${id})
      ELSE (SELECT 'agenda:pessoa:' || user_id FROM prestadores WHERE id = ${id})
    END, ${`agenda:${tipo}:${id}`}), 0))`
}

export const horarioCanonico = (valor: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(valor)
