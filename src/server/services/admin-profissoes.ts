import 'server-only'
import { createHash } from 'node:crypto'
import type { TipoServico as Profissao, Prisma } from '@/generated/prisma/client'
import { prisma } from '../db'
import { HttpError } from '../http'
import { creating, updating } from '../lucid'

const falha = (status: number, message: string) => new HttpError(status, { message })
const revisao = (e: Profissao) => createHash('sha256')
  .update(JSON.stringify([e.id, e.nome, e.descricao, e.ativo, e.slug, e.modalidade, e.ordem, e.updatedAt])).digest('hex')

export async function listarProfissoesAdmin() {
  const rows = await prisma.tipoServico.findMany({
    orderBy: [{ ordem: 'asc' }, { nome: 'asc' }],
    include: { _count: { select: { prestadores: true } } },
  })
  return rows.map(e => ({
    id: e.id, slug: e.slug, modalidade: e.modalidade, ordem: e.ordem, nome: e.nome, descricao: e.descricao, ativo: e.ativo === 1,
    vinculos: e._count.prestadores, revisao: revisao(e),
  }))
}

function objeto(body: unknown): Record<string, unknown> {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw falha(422, 'Dados inválidos.')
  return body as Record<string, unknown>
}

function dados(body: unknown) {
  const b = objeto(body)
  if (typeof b.nome !== 'string') throw falha(422, 'Informe o nome da profissao.')
  const nome = b.nome.normalize('NFC').trim().replace(/\s+/g, ' ')
  if (nome.length < 2 || nome.length > 100) throw falha(422, 'O nome deve ter entre 2 e 100 caracteres.')
  if (b.descricao != null && typeof b.descricao !== 'string') throw falha(422, 'Descrição inválida.')
  const descricao = typeof b.descricao === 'string' ? b.descricao.trim() || null : null
  if (descricao && descricao.length > 255) throw falha(422, 'A descrição deve ter até 255 caracteres.')
  if (typeof b.ativo !== 'boolean') throw falha(422, 'Informe se a profissão está ativa.')
  const slug = typeof b.slug === 'string' ? b.slug.trim() : ''
  if (!/^[a-z0-9]+(?:[-_][a-z0-9]+)*$/.test(slug) || slug.length > 50) throw falha(422, 'Identificador inválido. Use até 50 letras minúsculas, números, hífen ou sublinhado.')
  if (b.modalidade !== 'duracao' && b.modalidade !== 'periodo') throw falha(422, 'Escolha atendimento por duração ou período.')
  if (!Number.isInteger(b.ordem) || Number(b.ordem) < 0 || Number(b.ordem) > 9999) throw falha(422, 'Ordem deve ser um inteiro entre 0 e 9999.')
  return { nome, descricao, slug, modalidade: b.modalidade, ordem: Number(b.ordem), ativo: b.ativo ? 1 : 0 }
}

// Serializa as alterações administrativas: a unicidade original do banco diferencia caixa.
async function bloquearCatalogo(tx: Prisma.TransactionClient) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('admin-profissoes'))`
}

async function conferirNome(tx: Prisma.TransactionClient, nome: string, id?: string) {
  const iguais = await tx.$queryRaw<{ id: string }[]>`
    SELECT id FROM tipos_servico
    WHERE lower(regexp_replace(trim(nome), '[[:space:]]+', ' ', 'g')) = lower(${nome})
      AND (${id ?? null}::text IS NULL OR id <> ${id ?? null})
    LIMIT 1`
  if (iguais.length) throw falha(409, 'Já existe uma profissão com esse nome, inclusive entre as inativas.')
}

async function conferirRevisao(tx: Prisma.TransactionClient, id: string, body: unknown) {
  const atual = await tx.tipoServico.findUnique({ where: { id } })
  if (!atual) throw falha(404, 'Profissão não encontrada.')
  if (objeto(body).revisao !== revisao(atual)) {
    throw falha(409, 'Esta profissão foi alterada. Atualize a lista antes de salvar novamente.')
  }
  return atual
}

export async function criarProfissaoAdmin(body: unknown) {
  const data = dados(body)
  return prisma.$transaction(async tx => {
    await bloquearCatalogo(tx)
    await conferirNome(tx, data.nome)
    if (await tx.tipoServico.findUnique({ where: { slug: data.slug } })) throw falha(409, 'Identificador já utilizado.')
    const e = await tx.tipoServico.create({ data: creating(data) })
    return { id: e.id }
  })
}

export async function atualizarProfissaoAdmin(id: string, body: unknown) {
  const data = dados(body)
  return prisma.$transaction(async tx => {
    await bloquearCatalogo(tx)
    const atual = await conferirRevisao(tx, id, body)
    if (data.slug !== atual.slug) throw falha(422, 'O identificador não pode ser alterado depois do cadastro.')
    if (data.modalidade !== atual.modalidade && await tx.prestador.count({ where: { tipoServicoId: id } })) throw falha(409, 'Não é possível alterar a modalidade de uma profissão com profissionais vinculados.')
    await conferirNome(tx, data.nome, id)
    await tx.tipoServico.update({ where: { id }, data: updating(data) })
    return { id }
  })
}

/** Exclusão lógica: os relacionamentos nunca são apagados. */
export async function inativarProfissaoAdmin(id: string, body: unknown) {
  return prisma.$transaction(async tx => {
    await bloquearCatalogo(tx)
    await conferirRevisao(tx, id, body)
    await tx.tipoServico.update({ where: { id }, data: updating({ ativo: 0 }) })
    return { id }
  })
}
