import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { Pool } from 'pg'
import { configDaConexao } from '../src/server/db-conexao'
import { CONTAS } from './fixtures'

const HOSTS_LOCAIS = ['127.0.0.1:5433', 'localhost:5433']

function databaseUrlDoEnv() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL
  const arquivo = readFileSync(path.resolve(__dirname, '..', '.env'), 'utf8')
  const linha = arquivo.split(/\r?\n/).find((l) => l.trim().startsWith('DATABASE_URL='))
  return linha?.slice(linha.indexOf('=') + 1).trim().replace(/^["']|["']$/g, '')
}

/** A suíte cria e altera dados: só roda contra o Postgres local do docker (porta 5433). */
export default async function globalSetup() {
  const url = databaseUrlDoEnv()
  const host = url ? new URL(url).host : ''
  if (!HOSTS_LOCAIS.includes(host)) {
    throw new Error(`e2e recusado: DATABASE_URL precisa apontar para o banco local (${HOSTS_LOCAIS.join(' ou ')}).`)
  }
  execSync('npx prisma db seed', { stdio: 'inherit' })

  // Consultas futuras que execuções anteriores deixaram abertas lotam a grade dos vets do seed.
  // Pets criados pelos testes terminam com o sufixo numérico de Date.now() ou começam com "E2E".
  const db = new Pool(configDaConexao(url!))
  await db.query(
    `update agendamentos set status = 'cancelado', motivo_cancelamento = 'Limpeza e2e'
     where status in ('pendente', 'confirmado', 'em_andamento') and data_consulta >= to_char(current_date, 'YYYY-MM-DD')
       and pet_id in (select id from pets where nome ~ ' \\d{5,}$' or nome like 'E2E %')`
  )
  // Admin só no banco local: o seed também roda fora dos testes e as contas de demonstração têm senha conhecida.
  await db.query(`update users set is_admin = 1 where email = $1`, [CONTAS.admin.email])
  await db.end()
}
