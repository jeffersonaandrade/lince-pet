import 'server-only'
import type { Prisma } from '@/generated/prisma/client'
import { HttpError } from '../http'

/** Preserva vínculos antigos, mas recusa novas associações a opções inativas/inexistentes. */
export async function conferirNovasEspecialidades(tx: Prisma.TransactionClient, ids: string[]) {
  if (!ids.length) return
  // A trava de leitura evita inativação entre a conferência e a criação dos vínculos.
  const ativas = await tx.$queryRaw<{ id: string }[]>`
    SELECT id FROM especialidades WHERE id = ANY(${ids}::text[]) AND ativo = 1 FOR SHARE`
  if (ativas.length !== ids.length) {
    throw new HttpError(422, { message: 'Uma das especialidades está inativa ou não existe. Atualize a lista.' })
  }
}
