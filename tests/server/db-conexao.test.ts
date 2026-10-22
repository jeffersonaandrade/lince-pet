import { describe, expect, it } from 'vitest'
import { configDaConexao, SUPABASE_CA } from '@/server/db-conexao'

describe('configDaConexao', () => {
  it('banco local: sem SSL, com pool e timeout', () => {
    const url = 'postgresql://lincepet:lincepet@127.0.0.1:5433/lincepet'
    expect(configDaConexao(url)).toEqual({ connectionString: url, max: 5, connectionTimeoutMillis: 5000 })
  })

  it('Supabase: verifica o certificado com a CA do Supabase e tira o sslmode da URL', () => {
    const config = configDaConexao(
      'postgresql://postgres.abc:senha@aws-0-sa-east-1.pooler.supabase.com:5432/postgres?sslmode=require&pgbouncer=true',
    )
    expect(config.ssl).toEqual({ ca: SUPABASE_CA, rejectUnauthorized: true })
    expect(config.connectionString).not.toContain('sslmode')
    expect(config.connectionString).toContain('pgbouncer=true')
  })

  it('host direto do Supabase (.supabase.co) também usa a CA', () => {
    expect(configDaConexao('postgresql://postgres:x@db.abc.supabase.co:5432/postgres').ssl).toEqual({
      ca: SUPABASE_CA,
      rejectUnauthorized: true,
    })
  })

  it('URL ausente não lança na criação do client', () => {
    expect(configDaConexao('')).toEqual({ connectionString: '', max: 5, connectionTimeoutMillis: 5000 })
  })
})
