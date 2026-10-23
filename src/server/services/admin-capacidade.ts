import 'server-only'
import { prisma } from '../db'
import { medirCapacidade, type CapacidadeAdmin } from '@/lib/capacidade'

type Tabela = { schema: string; nome: string; bytes: bigint; registros: bigint }
type Bucket = { nome: string; bytes: bigint; objetos: bigint; sem_tamanho: bigint }
const TTL_MS = 60_000

// Cache apenas de metadados agregados, por instância. A rota revalida o admin antes de acessá-lo.
let cache: { ate: number; dados: CapacidadeAdmin } | undefined
let emCurso: Promise<CapacidadeAdmin> | undefined

function limiteConfigurado(nome: string, padrao: number) {
  const valor = process.env[nome] ? Number(process.env[nome]) : padrao
  if (!Number.isFinite(valor) || valor <= 0) throw new Error(`Configure ${nome} com um número positivo`)
  return valor
}

async function banco(limiteBytes: number): Promise<CapacidadeAdmin['banco']> {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SET TRANSACTION READ ONLY`
    await tx.$executeRaw`SET LOCAL statement_timeout = '3000ms'`
    const [medicao] = await tx.$queryRaw<{ bytes: bigint }[]>`SELECT pg_database_size(current_database())::bigint AS bytes`
    const tabelas = await tx.$queryRaw<Tabela[]>`
      SELECT schemaname AS schema, relname AS nome,
        pg_total_relation_size(relid)::bigint AS bytes, n_live_tup::bigint AS registros
      FROM pg_stat_user_tables
      ORDER BY pg_total_relation_size(relid) DESC, schemaname, relname
      LIMIT 15`
    return {
      status: 'disponivel', uso: medirCapacidade(Number(medicao.bytes), limiteBytes),
      tabelas: tabelas.map((t) => ({ schema: t.schema, nome: t.nome, bytes: Number(t.bytes), registrosEstimados: Number(t.registros) })),
    }
  }, { timeout: 8000, maxWait: 2000 })
}

async function storage(limiteBytes: number): Promise<CapacidadeAdmin['storage']> {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SET TRANSACTION READ ONLY`
    await tx.$executeRaw`SET LOCAL statement_timeout = '3000ms'`
    const [schema] = await tx.$queryRaw<{ existe: boolean }[]>`SELECT to_regclass('storage.objects') IS NOT NULL AS existe`
    if (!schema.existe) return { status: 'nao_configurado', uso: null, objetos: 0, semTamanho: 0, buckets: [] }
    const buckets = await tx.$queryRaw<Bucket[]>`
      SELECT bucket_id AS nome, count(*)::bigint AS objetos,
        coalesce(sum(CASE WHEN metadata->>'size' ~ '^[0-9]{1,16}$' THEN (metadata->>'size')::numeric ELSE 0 END), 0)::bigint AS bytes,
        count(*) FILTER (WHERE coalesce(metadata->>'size', '') !~ '^[0-9]{1,16}$')::bigint AS sem_tamanho
      FROM storage.objects GROUP BY bucket_id ORDER BY bytes DESC, bucket_id`
    const bytes = buckets.reduce((s, b) => s + Number(b.bytes), 0)
    const semTamanho = buckets.reduce((s, b) => s + Number(b.sem_tamanho), 0)
    return {
      status: semTamanho ? 'parcial' : 'disponivel', uso: medirCapacidade(bytes, limiteBytes),
      objetos: buckets.reduce((s, b) => s + Number(b.objetos), 0), semTamanho,
      buckets: buckets.map((b) => ({ nome: b.nome, bytes: Number(b.bytes), objetos: Number(b.objetos) })),
    }
  }, { timeout: 8000, maxWait: 2000 })
}

async function consultar(): Promise<CapacidadeAdmin> {
  const bancoMb = limiteConfigurado('ADMIN_CAPACIDADE_BANCO_MB', 500)
  const storageGb = limiteConfigurado('ADMIN_CAPACIDADE_STORAGE_GB', 1)
  const [db, arquivos] = await Promise.allSettled([banco(bancoMb * 1_000_000), storage(storageGb * 1_000_000_000)])
  // Falha de uma fonte nunca vira "0% usado". Não envia erros internos para o navegador.
  if (db.status === 'rejected') console.error('[Admin capacidade] Falha ao medir banco')
  if (arquivos.status === 'rejected') console.error('[Admin capacidade] Falha ao medir storage')
  return {
    consultadoEm: new Date().toISOString(), referencia: { bancoMb, storageGb },
    banco: db.status === 'fulfilled' ? db.value : { status: 'indisponivel', uso: null, tabelas: [] },
    storage: arquivos.status === 'fulfilled' ? arquivos.value : { status: 'indisponivel', uso: null, objetos: 0, semTamanho: 0, buckets: [] },
  }
}

export async function consultarCapacidade(): Promise<CapacidadeAdmin> {
  if (cache && Date.now() < cache.ate) return cache.dados
  if (!emCurso) {
    emCurso = consultar().then((dados) => {
      const falha = dados.banco.status === 'indisponivel' || dados.storage.status === 'indisponivel'
      cache = { dados, ate: Date.now() + (falha ? 5000 : TTL_MS) }
      return dados
    }).finally(() => { emCurso = undefined })
  }
  return emCurso
}
