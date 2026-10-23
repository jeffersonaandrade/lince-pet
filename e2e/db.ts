import 'dotenv/config'
import { Pool } from 'pg'
import { configDaConexao } from '../src/server/db-conexao'

/** Acesso direto ao banco local (o global-setup já recusou qualquer outro) para preparar e conferir estado. */
export const db = new Pool(configDaConexao(process.env.DATABASE_URL ?? ''))

export async function consultar<T = Record<string, unknown>>(sql: string, params: unknown[] = []) {
  return (await db.query(sql, params)).rows as T[]
}

export async function tokenDeRedefinicao(email: string) {
  const [linha] = await consultar<{ token: string }>(
    `select t.token from password_reset_tokens t join users u on u.id = t.user_id where u.email = $1`,
    [email.toLowerCase()]
  )
  if (!linha) throw new Error(`Sem token de redefinição para ${email}`)
  return linha.token
}
