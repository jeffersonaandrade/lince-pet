import 'server-only'
import type { Prisma } from '@/generated/prisma/client'
import { HttpError } from '../http'

/** Vínculos existentes permanecem; apenas novas adesões exigem opção ativa. */
export async function conferirNovosPlanosSaude(tx: Prisma.TransactionClient, ids: string[]) {
  if (!ids.length) return
  const ativos = await tx.$queryRaw<{ id: string }[]>`
    SELECT id FROM planos WHERE id = ANY(${ids}::text[]) AND ativo = 1 FOR SHARE`
  if (ativos.length !== ids.length) throw new HttpError(422, { message: 'Um dos planos de saúde está inativo ou não existe. Atualize a lista.' })
}
