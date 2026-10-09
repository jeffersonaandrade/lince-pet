import { describe, it, expect } from 'vitest'
import {
  type ColunaPg,
  montarInsert,
  normalizarValor,
  ordenarPorDependencia,
  planejar,
  sqlAjusteSequencia,
  tamanhoLote,
} from '../../scripts/migrar-dados-mysql/core'

const col = (tabela: string, coluna: string, tipo = 'varchar', extra: Partial<ColunaPg> = {}): ColunaPg => ({
  tabela,
  coluna,
  tipo,
  nulo: true,
  temDefault: false,
  serial: false,
  ...extra,
})

describe('planejar', () => {
  const pg = [
    col('users', 'id', 'bpchar', { nulo: false }),
    col('users', 'email'),
    col('users', 'notificar_email', 'int2', { nulo: false, temDefault: true }),
    col('pets', 'id', 'bpchar', { nulo: false }),
    col('pets', 'especie_nova', 'varchar', { nulo: false }),
    col('encaminhamentos', 'id', 'bpchar', { nulo: false }),
  ]
  const mysql = new Map([
    ['users', ['id', 'email', 'remember_me_token']],
    ['pets', ['id']],
    ['adonis_schema', ['id']],
    ['api_tokens', ['id']],
  ])
  const plano = planejar(mysql, pg)

  it('copia só as colunas em comum e lista novas e descartadas', () => {
    const users = plano.tabelas.find((t) => t.tabela === 'users')!
    expect(users.colunas.map((c) => c.coluna)).toEqual(['id', 'email'])
    expect(users.soNoPg).toEqual(['notificar_email'])
    expect(users.soNoMysql).toEqual(['remember_me_token'])
    expect(users.obrigatoriasFaltando).toEqual([])
  })

  it('aponta coluna NOT NULL sem default ausente no MySQL', () => {
    expect(plano.tabelas.find((t) => t.tabela === 'pets')!.obrigatoriasFaltando).toEqual(['especie_nova'])
  })

  it('separa tabelas só de um lado e ignora as do Adonis', () => {
    expect(plano.tabelasSoNoMysql).toEqual(['api_tokens'])
    expect(plano.tabelasSoNoPg).toEqual(['encaminhamentos'])
  })
})

describe('ordenarPorDependencia', () => {
  it('insere pais antes dos filhos e ignora auto-referência', () => {
    const { ordem, ciclos } = ordenarPorDependencia(
      ['agendamentos', 'pets', 'tutores', 'users'],
      [
        { tabela: 'agendamentos', referencia: 'pets' },
        { tabela: 'pets', referencia: 'tutores' },
        { tabela: 'tutores', referencia: 'users' },
        { tabela: 'users', referencia: 'users' },
        { tabela: 'agendamentos', referencia: 'fora_do_plano' },
      ]
    )
    expect(ordem).toEqual(['users', 'tutores', 'pets', 'agendamentos'])
    expect(ciclos).toEqual([])
  })

  it('ciclos vão para o fim e são reportados', () => {
    const { ordem, ciclos } = ordenarPorDependencia(
      ['a', 'b', 'c'],
      [
        { tabela: 'a', referencia: 'b' },
        { tabela: 'b', referencia: 'a' },
      ]
    )
    expect(ordem).toEqual(['c', 'a', 'b'])
    expect(ciclos).toEqual(['a', 'b'])
  })
})

describe('normalizarValor', () => {
  it('null, datas zeradas e texto', () => {
    expect(normalizarValor(null, 'varchar')).toBeNull()
    expect(normalizarValor('0000-00-00 00:00:00', 'timestamp')).toBeNull()
    expect(normalizarValor('2026-10-09 12:00:00', 'timestamp')).toBe('2026-10-09 12:00:00')
    expect(normalizarValor('a\u0000b', 'text')).toBe('ab')
  })

  it('JSON, números, booleanos e buffers', () => {
    expect(normalizarValor({ seg: ['08:00'] }, 'jsonb')).toBe('{"seg":["08:00"]}')
    expect(normalizarValor('{"a":1}', 'jsonb')).toBe('{"a":1}')
    expect(normalizarValor(1, 'int2')).toBe('1')
    expect(normalizarValor('150.00', 'numeric')).toBe('150.00')
    expect(normalizarValor(true, 'int2')).toBe('1')
    expect(normalizarValor(1, 'bool')).toBe('true')
    expect(normalizarValor(Buffer.from([1]), 'int2')).toBe('1')
    expect(normalizarValor(Buffer.from('abc'), 'bpchar')).toBe('abc')
  })
})

describe('montarInsert', () => {
  it('gera INSERT em lote com cast por coluna e ON CONFLICT DO NOTHING', () => {
    const { sql, params } = montarInsert(
      'users',
      [col('users', 'id', 'bpchar'), col('users', 'user_type', 'UserType')],
      [
        ['u1', 'tutor'],
        ['u2', null],
      ]
    )
    expect(sql).toBe(
      'INSERT INTO "users" ("id", "user_type") VALUES ($1::"bpchar", $2::"UserType"), ($3::"bpchar", $4::"UserType") ON CONFLICT DO NOTHING'
    )
    expect(params).toEqual(['u1', 'tutor', 'u2', null])
  })

  it('lote respeita o limite de parâmetros do Postgres', () => {
    expect(tamanhoLote(10)).toBe(500)
    expect(tamanhoLote(100) * 100).toBeLessThanOrEqual(32767)
  })

  it('ajusta a sequência de colunas autoincrement', () => {
    expect(sqlAjusteSequencia('webhook_events', 'id')).toBe(
      `SELECT setval(pg_get_serial_sequence('"webhook_events"', 'id'), COALESCE(MAX("id"), 1), MAX("id") IS NOT NULL) FROM "webhook_events"`
    )
  })
})
