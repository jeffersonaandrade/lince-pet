/**
 * Copia os dados do MySQL antigo para o PostgreSQL atual (schema já criado pelo `prisma migrate deploy`).
 *
 *   npm run db:migrar-mysql                              -> só confere (não grava): tabelas, colunas e contagens
 *   npm run db:migrar-mysql -- --executar                -> copia tudo numa transação e confere as contagens
 *   npm run db:migrar-mysql -- --env=.env.production     -> destino = Supabase (DATABASE_URL desse arquivo)
 *
 * Origem: MYSQL_ORIGEM_URL (mysql://usuario:senha@host:3306/banco). Destino: DATABASE_URL.
 */
import { existsSync } from 'node:fs'
import mysql from 'mysql2/promise'
import { PrismaClient } from '@prisma/client'
import {
  type ColunaPg,
  type Fk,
  idMysql,
  montarInsert,
  normalizarValor,
  ordenarPorDependencia,
  planejar,
  sqlAjusteSequencia,
  tamanhoLote,
} from './migrar-dados-mysql/core'

const args = process.argv.slice(2)
const executar = args.includes('--executar')
const arquivoEnv = args.find((a) => a.startsWith('--env='))?.slice('--env='.length) ?? '.env'
if (existsSync(arquivoEnv)) process.loadEnvFile(arquivoEnv)

const origemUrl = process.env.MYSQL_ORIGEM_URL
const destinoUrl = process.env.DATABASE_URL
if (!origemUrl || !destinoUrl) {
  console.error('Defina MYSQL_ORIGEM_URL (origem) e DATABASE_URL (destino).')
  process.exit(1)
}

const hostDe = (url: string) => {
  try {
    const u = new URL(url)
    return `${u.hostname}:${u.port}${u.pathname}`
  } catch {
    return '(url inválida)'
  }
}

async function main() {
  const origem = await mysql.createConnection({
    uri: origemUrl,
    dateStrings: true,
    supportBigNumbers: true,
    bigNumberStrings: true,
    typeCast: (field, next) => (field.type === 'JSON' ? field.string() : next()),
  })
  await origem.query("SET time_zone = '+00:00'")
  const destino = new PrismaClient({ datasourceUrl: destinoUrl })

  try {
    console.log(`Origem MySQL:  ${hostDe(origemUrl!)}`)
    console.log(`Destino Postgres: ${hostDe(destinoUrl!)}`)
    console.log(executar ? 'Modo: EXECUTAR (grava no destino)\n' : 'Modo: conferência (nada é gravado)\n')

    const [colunasMysql] = await origem.query<mysql.RowDataPacket[]>(
      `SELECT TABLE_NAME AS tabela, COLUMN_NAME AS coluna FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() ORDER BY TABLE_NAME, ORDINAL_POSITION`
    )
    const mysqlCatalogo = new Map<string, string[]>()
    for (const r of colunasMysql) {
      const t = String(r.tabela).toLowerCase()
      mysqlCatalogo.set(t, [...(mysqlCatalogo.get(t) ?? []), String(r.coluna).toLowerCase()])
    }

    const [pks] = await origem.query<mysql.RowDataPacket[]>(
      `SELECT TABLE_NAME AS tabela, COLUMN_NAME AS coluna FROM information_schema.KEY_COLUMN_USAGE
       WHERE TABLE_SCHEMA = DATABASE() AND CONSTRAINT_NAME = 'PRIMARY' ORDER BY ORDINAL_POSITION`
    )
    const pkMysql = new Map<string, string[]>()
    for (const r of pks) {
      const t = String(r.tabela).toLowerCase()
      pkMysql.set(t, [...(pkMysql.get(t) ?? []), String(r.coluna)])
    }

    const colunasPg = (
      await destino.$queryRaw<
        { tabela: string; coluna: string; tipo: string; nulo: string; padrao: string | null }[]
      >`SELECT table_name AS tabela, column_name AS coluna, udt_name AS tipo, is_nullable AS nulo, column_default AS padrao
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name <> '_prisma_migrations'
        ORDER BY table_name, ordinal_position`
    ).map<ColunaPg>((c) => ({
      tabela: c.tabela,
      coluna: c.coluna,
      tipo: c.tipo,
      nulo: c.nulo === 'YES',
      temDefault: c.padrao !== null,
      serial: Boolean(c.padrao?.startsWith('nextval(')),
    }))
    const fks = await destino.$queryRaw<Fk[]>`
      SELECT DISTINCT tc.table_name AS tabela, ccu.table_name AS referencia
      FROM information_schema.table_constraints tc
      JOIN information_schema.constraint_column_usage ccu
        ON ccu.constraint_name = tc.constraint_name AND ccu.table_schema = tc.table_schema
      WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema = 'public'`

    const plano = planejar(mysqlCatalogo, colunasPg)
    const { ordem, ciclos } = ordenarPorDependencia(
      plano.tabelas.map((t) => t.tabela),
      fks
    )
    const porTabela = new Map(plano.tabelas.map((t) => [t.tabela, t]))

    const contarMysql = async (t: string) =>
      Number((await origem.query<mysql.RowDataPacket[]>(`SELECT COUNT(*) AS n FROM ${idMysql(t)}`))[0][0].n)
    const contarPg = async (t: string) =>
      Number((await destino.$queryRawUnsafe<{ n: number }[]>(`SELECT COUNT(*)::int AS n FROM "${t}"`))[0].n)

    const antes = new Map<string, { mysql: number; pg: number }>()
    for (const t of ordem) antes.set(t, { mysql: await contarMysql(t), pg: await contarPg(t) })

    console.table(
      ordem.map((t) => ({
        tabela: t,
        mysql: antes.get(t)!.mysql,
        postgres: antes.get(t)!.pg,
        'colunas novas (default)': porTabela.get(t)!.soNoPg.join(', '),
        'colunas descartadas': porTabela.get(t)!.soNoMysql.join(', '),
      }))
    )
    const totalMysql = [...antes.values()].reduce((s, c) => s + c.mysql, 0)
    console.log(`Total de linhas no MySQL nas tabelas em comum: ${totalMysql}`)
    if (plano.tabelasSoNoMysql.length) console.log(`Só no MySQL (não copiadas): ${plano.tabelasSoNoMysql.join(', ')}`)
    if (plano.tabelasSoNoPg.length) console.log(`Só no Postgres (sem origem): ${plano.tabelasSoNoPg.join(', ')}`)
    if (ciclos.length) console.log(`Atenção, FKs em ciclo (copiadas por último): ${ciclos.join(', ')}`)

    const bloqueios = plano.tabelas.filter((t) => t.obrigatoriasFaltando.length && antes.get(t.tabela)!.mysql > 0)
    for (const b of bloqueios) {
      console.error(`Bloqueio: ${b.tabela} exige ${b.obrigatoriasFaltando.join(', ')} (NOT NULL sem default, ausente no MySQL).`)
    }
    const destinoComDados = ordem.filter((t) => antes.get(t)!.pg > 0)
    if (destinoComDados.length) {
      console.log(`Destino já tem linhas em: ${destinoComDados.join(', ')}. Linhas com a mesma chave serão mantidas (ON CONFLICT DO NOTHING).`)
    }

    if (!executar) {
      console.log('\nConferência concluída. Para copiar, rode de novo com --executar.')
      return
    }
    if (bloqueios.length) {
      console.error('\nCópia cancelada: resolva os bloqueios acima.')
      process.exitCode = 1
      return
    }

    const inseridas = new Map<string, number>()
    await destino.$transaction(
      async (tx) => {
        for (const t of ordem) {
          const { colunas } = porTabela.get(t)!
          if (!antes.get(t)!.mysql || !colunas.length) continue
          const lote = tamanhoLote(colunas.length)
          const ordenarPor = (pkMysql.get(t) ?? []).map(idMysql).join(', ') || '1'
          const selecao = colunas.map((c) => idMysql(c.coluna)).join(', ')
          let total = 0
          for (let offset = 0; ; offset += lote) {
            const [linhas] = await origem.query<mysql.RowDataPacket[]>(
              `SELECT ${selecao} FROM ${idMysql(t)} ORDER BY ${ordenarPor} LIMIT ${lote} OFFSET ${offset}`
            )
            if (!linhas.length) break
            const valores = linhas.map((l) => colunas.map((c) => normalizarValor(l[c.coluna], c.tipo)))
            const { sql, params } = montarInsert(t, colunas, valores)
            total += await tx.$executeRawUnsafe(sql, ...params)
            if (linhas.length < lote) break
          }
          inseridas.set(t, total)
          console.log(`  ${t}: ${total} de ${antes.get(t)!.mysql}`)
          for (const c of colunas.filter((c) => c.serial)) await tx.$queryRawUnsafe(sqlAjusteSequencia(t, c.coluna))
        }
      },
      { maxWait: 60_000, timeout: 60 * 60_000 }
    )

    const divergentes: string[] = []
    for (const t of ordem) {
      const depois = await contarPg(t)
      if (depois < antes.get(t)!.mysql) divergentes.push(`${t} (MySQL ${antes.get(t)!.mysql}, Postgres ${depois})`)
    }
    console.log(`\nCópia concluída: ${[...inseridas.values()].reduce((s, n) => s + n, 0)} linhas inseridas.`)
    if (divergentes.length) {
      console.log(`Tabelas com menos linhas que o MySQL (chave já existente no destino): ${divergentes.join('; ')}`)
    } else {
      console.log('Contagens conferem: todas as tabelas têm pelo menos as linhas do MySQL.')
    }
  } finally {
    await origem.end()
    await destino.$disconnect()
  }
}

main().catch((erro) => {
  console.error('Falha na migração (nada foi gravado se o erro ocorreu durante a cópia):', erro)
  process.exit(1)
})
