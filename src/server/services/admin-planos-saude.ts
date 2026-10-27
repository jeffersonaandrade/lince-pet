import 'server-only'
import { createHash } from 'node:crypto'
import type { Plano as PlanoSaude, Prisma } from '@/generated/prisma/client'
import { prisma } from '../db'
import { HttpError } from '../http'
import { creating, updating } from '../lucid'

const falha = (status: number, message: string) => new HttpError(status, { message })
const revisao = (e: PlanoSaude) => createHash('sha256')
  .update(JSON.stringify([e.id, e.name, e.descricao, e.ativo, e.updatedAt])).digest('hex')

export async function listarPlanosSaudeAdmin() {
  const rows = await prisma.plano.findMany({
    orderBy: { name: 'asc' },
    include: { _count: { select: { veterinarioPlanos: true, clinicaPlanos: true } } },
  })
  return rows.map(e => ({
    id: e.id, nome: e.name, descricao: e.descricao, ativo: e.ativo === 1,
    vinculos: e._count.veterinarioPlanos + e._count.clinicaPlanos, revisao: revisao(e),
  }))
}

function objeto(body: unknown): Record<string, unknown> {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw falha(422, 'Dados inválidos.')
  return body as Record<string, unknown>
}

function dados(body: unknown) {
  const b = objeto(body)
  if (typeof b.nome !== 'string') throw falha(422, 'Informe o nome do plano de saúde.')
  const nome = b.nome.normalize('NFC').trim().replace(/\s+/g, ' ')
  if (nome.length < 2 || nome.length > 255) throw falha(422, 'O nome deve ter entre 2 e 255 caracteres.')
  if (b.descricao != null && typeof b.descricao !== 'string') throw falha(422, 'Descrição inválida.')
  const descricao = typeof b.descricao === 'string' ? b.descricao.trim() || null : null
  if (descricao && descricao.length > 500) throw falha(422, 'A descrição deve ter até 500 caracteres.')
  if (typeof b.ativo !== 'boolean') throw falha(422, 'Informe se o plano de saúde está ativo.')
  return { name: nome, descricao, ativo: b.ativo ? 1 : 0 }
}

// Serializa as alterações administrativas: a unicidade original do banco diferencia caixa.
async function bloquearCatalogo(tx: Prisma.TransactionClient) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('admin-planos-saude'))`
}

async function conferirNome(tx: Prisma.TransactionClient, nome: string, id?: string) {
  const iguais = await tx.$queryRaw<{ id: string }[]>`
    SELECT id FROM planos
    WHERE lower(regexp_replace(trim(name), '[[:space:]]+', ' ', 'g')) = lower(${nome})
      AND (${id ?? null}::text IS NULL OR id <> ${id ?? null})
    LIMIT 1`
  if (iguais.length) throw falha(409, 'Já existe um plano de saúde com esse nome, inclusive entre as inativas.')
}

async function conferirRevisao(tx: Prisma.TransactionClient, id: string, body: unknown) {
  const atual = await tx.plano.findUnique({ where: { id } })
  if (!atual) throw falha(404, 'Plano de saúde não encontrado.')
  if (objeto(body).revisao !== revisao(atual)) {
    throw falha(409, 'Este plano de saúde foi alterado. Atualize a lista antes de salvar novamente.')
  }
  return atual
}

export async function criarPlanoSaudeAdmin(body: unknown) {
  const data = dados(body)
  return prisma.$transaction(async tx => {
    await bloquearCatalogo(tx)
    await conferirNome(tx, data.name)
    const e = await tx.plano.create({ data: creating(data) })
    return { id: e.id }
  })
}

export async function atualizarPlanoSaudeAdmin(id: string, body: unknown) {
  const data = dados(body)
  return prisma.$transaction(async tx => {
    await bloquearCatalogo(tx)
    await conferirRevisao(tx, id, body)
    await conferirNome(tx, data.name, id)
    await tx.plano.update({ where: { id }, data: updating(data) })
    return { id }
  })
}

/** Exclusão lógica: os relacionamentos nunca são apagados. */
export async function inativarPlanoSaudeAdmin(id: string, body: unknown) {
  return prisma.$transaction(async tx => {
    await bloquearCatalogo(tx)
    await conferirRevisao(tx, id, body)
    await tx.plano.update({ where: { id }, data: updating({ ativo: 0 }) })
    return { id }
  })
}
