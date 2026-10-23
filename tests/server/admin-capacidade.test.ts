import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { medirCapacidade, formatarBytes } from '@/lib/capacidade'

const db = vi.hoisted(() => ({ $transaction: vi.fn(), $queryRaw: vi.fn(), $executeRaw: vi.fn() }))
vi.mock('@/server/db', () => ({ prisma: db }))

beforeEach(() => {
  vi.resetModules()
  vi.clearAllMocks()
  vi.stubEnv('ADMIN_CAPACIDADE_BANCO_MB', '')
  vi.stubEnv('ADMIN_CAPACIDADE_STORAGE_GB', '')
  db.$transaction.mockImplementation((fn: (tx: unknown) => unknown) => fn(db))
  db.$queryRaw.mockImplementation(async (strings: TemplateStringsArray) => {
    const sql = strings.join('')
    if (sql.includes('pg_database_size')) return [{ bytes: BigInt(450_000_000) }]
    if (sql.includes('pg_stat_user_tables')) return [{ schema: 'evolution', nome: 'Message', bytes: BigInt(1234), registros: BigInt(25) }]
    if (sql.includes('to_regclass')) return [{ existe: true }]
    return [{ nome: 'lincepet-media', bytes: BigInt(700_000_000), objetos: BigInt(40), sem_tamanho: BigInt(0) }]
  })
})
afterEach(() => { vi.unstubAllEnvs(); vi.useRealTimers(); vi.restoreAllMocks() })

describe('aviso de capacidade', () => {
  it.each([[0, 'normal'], [69, 'normal'], [70, 'atencao'], [89, 'atencao'], [90, 'critico'], [100, 'excedido'], [120, 'excedido']])('uso %s/100 tem nível %s', (bytes, nivel) => {
    expect(medirCapacidade(Number(bytes), 100).nivel).toBe(nivel)
  })
  it('mantém percentual acima de 100% e não apresenta folga negativa', () => {
    expect(medirCapacidade(120, 100)).toMatchObject({ percentual: 120, livresBytes: 0 })
    expect(() => medirCapacidade(-1, 100)).toThrow()
    expect(() => medirCapacidade(0, 0)).toThrow()
  })
  it('formata bytes sem misturar MB com MiB', () => {
    expect(formatarBytes(500_000_000)).toBe('500 MB')
    expect(formatarBytes(0)).toBe('0 B')
  })
})

describe('consultarCapacidade', () => {
  it('separa banco/arquivos, inclui schemas compartilhados e devolve JSON serializável', async () => {
    const { consultarCapacidade } = await import('@/server/services/admin-capacidade')
    const result = await consultarCapacidade()
    expect(result.banco.uso).toMatchObject({ percentual: 90, nivel: 'critico', limiteBytes: 500_000_000 })
    expect(result.storage.uso).toMatchObject({ percentual: 70, nivel: 'atencao' })
    expect(result.banco.tabelas[0]).toMatchObject({ schema: 'evolution', registrosEstimados: 25 })
    expect(() => JSON.stringify(result)).not.toThrow()
    const consultas = db.$executeRaw.mock.calls.map(([sql]) => sql.join(''))
    expect(consultas.filter((sql) => sql.includes('READ ONLY'))).toHaveLength(2)
    expect(consultas.filter((sql) => sql.includes('statement_timeout'))).toHaveLength(2)
  })
  it('falha do storage não transforma o consumo em zero nem esconde o banco', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    db.$transaction.mockImplementationOnce((fn: (tx: unknown) => unknown) => fn(db)).mockRejectedValueOnce(new Error('permission denied'))
    const { consultarCapacidade } = await import('@/server/services/admin-capacidade')
    const result = await consultarCapacidade()
    expect(result.banco.status).toBe('disponivel')
    expect(result.storage).toMatchObject({ status: 'indisponivel', uso: null })
    expect(JSON.stringify(result)).not.toContain('permission denied')
  })
  it('ausência do schema storage é não medido, não 0% livre', async () => {
    const original = db.$queryRaw.getMockImplementation()!
    db.$queryRaw.mockImplementation((strings) => strings.join('').includes('to_regclass') ? [{ existe: false }] : original(strings))
    const { consultarCapacidade } = await import('@/server/services/admin-capacidade')
    expect((await consultarCapacidade()).storage).toMatchObject({ status: 'nao_configurado', uso: null })
  })
  it('metadados sem tamanho sinalizam leitura parcial', async () => {
    const original = db.$queryRaw.getMockImplementation()!
    db.$queryRaw.mockImplementation((strings) => strings.join('').includes('FROM storage.objects')
      ? [{ nome: 'laudos', bytes: BigInt(0), objetos: BigInt(2), sem_tamanho: BigInt(2) }] : original(strings))
    const { consultarCapacidade } = await import('@/server/services/admin-capacidade')
    expect((await consultarCapacidade()).storage).toMatchObject({ status: 'parcial', semTamanho: 2 })
  })
  it('deduplica requisições simultâneas e reutiliza metadados por 60 segundos', async () => {
    vi.useFakeTimers()
    const { consultarCapacidade } = await import('@/server/services/admin-capacidade')
    await Promise.all([consultarCapacidade(), consultarCapacidade(), consultarCapacidade()])
    expect(db.$transaction).toHaveBeenCalledTimes(2)
    await consultarCapacidade()
    expect(db.$transaction).toHaveBeenCalledTimes(2)
    vi.advanceTimersByTime(60_001)
    await consultarCapacidade()
    expect(db.$transaction).toHaveBeenCalledTimes(4)
  })
  it('aceita limites de referência configurados após mudança de plano', async () => {
    vi.stubEnv('ADMIN_CAPACIDADE_BANCO_MB', '8000')
    vi.stubEnv('ADMIN_CAPACIDADE_STORAGE_GB', '100')
    const { consultarCapacidade } = await import('@/server/services/admin-capacidade')
    const result = await consultarCapacidade()
    expect(result.banco.uso?.limiteBytes).toBe(8_000_000_000)
    expect(result.storage.uso?.limiteBytes).toBe(100_000_000_000)
  })
})
