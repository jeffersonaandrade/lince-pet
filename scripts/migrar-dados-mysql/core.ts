/** Regras puras da cópia MySQL -> PostgreSQL (sem I/O), usadas por scripts/migrar-dados-mysql.ts. */

export type ColunaPg = {
  tabela: string
  coluna: string
  /** udt_name do Postgres (int4, timestamp, jsonb, UserType...). */
  tipo: string
  nulo: boolean
  temDefault: boolean
  serial: boolean
}

export type Fk = { tabela: string; referencia: string }

export type PlanoTabela = {
  tabela: string
  colunas: ColunaPg[]
  /** Colunas novas no Postgres (ficam com o default ou NULL). */
  soNoPg: string[]
  /** Colunas NOT NULL sem default que o MySQL não tem: a cópia falharia. */
  obrigatoriasFaltando: string[]
  /** Colunas do MySQL que não existem mais no Postgres (descartadas). */
  soNoMysql: string[]
}

export type Plano = {
  tabelas: PlanoTabela[]
  tabelasSoNoMysql: string[]
  tabelasSoNoPg: string[]
}

/** Tabelas do Adonis/Lucid que não fazem parte do schema do Prisma. */
export const TABELAS_IGNORADAS = new Set(['adonis_schema', 'adonis_schema_versions', '_prisma_migrations'])

/** Cruza o catálogo dos dois bancos: o que copiar, o que fica de fora e o que bloquearia a cópia. */
export function planejar(mysql: Map<string, string[]>, pg: ColunaPg[]): Plano {
  const pgPorTabela = new Map<string, ColunaPg[]>()
  for (const c of pg) pgPorTabela.set(c.tabela, [...(pgPorTabela.get(c.tabela) ?? []), c])

  const tabelas: PlanoTabela[] = []
  for (const [tabela, colunasPg] of pgPorTabela) {
    const colunasMysql = mysql.get(tabela)
    if (!colunasMysql) continue
    const noMysql = new Set(colunasMysql)
    const noPg = new Set(colunasPg.map((c) => c.coluna))
    const faltando = colunasPg.filter((c) => !noMysql.has(c.coluna))
    tabelas.push({
      tabela,
      colunas: colunasPg.filter((c) => noMysql.has(c.coluna)),
      soNoPg: faltando.map((c) => c.coluna),
      obrigatoriasFaltando: faltando.filter((c) => !c.nulo && !c.temDefault).map((c) => c.coluna),
      soNoMysql: colunasMysql.filter((c) => !noPg.has(c)),
    })
  }

  return {
    tabelas,
    tabelasSoNoMysql: [...mysql.keys()].filter((t) => !pgPorTabela.has(t) && !TABELAS_IGNORADAS.has(t)).sort(),
    tabelasSoNoPg: [...pgPorTabela.keys()].filter((t) => !mysql.has(t)).sort(),
  }
}

/** Ordem de inserção que respeita as FKs (pais antes dos filhos). Ciclos vão para o fim. */
export function ordenarPorDependencia(tabelas: string[], fks: Fk[]) {
  const alvo = new Set(tabelas)
  const pais = new Map(tabelas.map((t) => [t, new Set<string>()]))
  for (const { tabela, referencia } of fks) {
    if (tabela !== referencia && alvo.has(tabela) && alvo.has(referencia)) pais.get(tabela)!.add(referencia)
  }

  const ordem: string[] = []
  const feitas = new Set<string>()
  let progresso = true
  while (progresso) {
    progresso = false
    for (const t of [...tabelas].sort()) {
      if (feitas.has(t) || [...pais.get(t)!].some((p) => !feitas.has(p))) continue
      ordem.push(t)
      feitas.add(t)
      progresso = true
    }
  }
  const ciclos = tabelas.filter((t) => !feitas.has(t)).sort()
  return { ordem: [...ordem, ...ciclos], ciclos }
}

const DATA_ZERADA = /^0000-00-00/

/** Converte o valor lido do mysql2 (com dateStrings e JSON como texto) para texto que o Postgres faz cast. */
export function normalizarValor(valor: unknown, tipoPg: string): string | null {
  if (valor === null || valor === undefined) return null
  if (Buffer.isBuffer(valor)) {
    if (tipoPg === 'bool' || tipoPg.startsWith('int')) return String(valor.length ? valor[0] : 0)
    return valor.toString('utf8').replace(/\u0000/g, '')
  }
  if (valor instanceof Date) return Number.isNaN(valor.getTime()) ? null : valor.toISOString()
  if (typeof valor === 'boolean') return tipoPg === 'bool' ? String(valor) : valor ? '1' : '0'
  if (typeof valor === 'object') return JSON.stringify(valor)

  const texto = String(valor)
  if (DATA_ZERADA.test(texto) && /^(timestamp|timestamptz|date)$/.test(tipoPg)) return null
  if (tipoPg === 'bool') return texto === '1' || texto.toLowerCase() === 'true' ? 'true' : 'false'
  return texto.replace(/\u0000/g, '')
}

const id = (nome: string) => `"${nome.replace(/"/g, '""')}"`

/** Linhas por INSERT, abaixo do limite de 32767 parâmetros do Postgres. */
export const tamanhoLote = (colunas: number) => Math.max(1, Math.min(500, Math.floor(30000 / Math.max(1, colunas))))

/** INSERT em lote com cast explícito por coluna; linha que já existe (PK ou UNIQUE) é ignorada. */
export function montarInsert(tabela: string, colunas: ColunaPg[], linhas: (string | null)[][]) {
  const params: (string | null)[] = []
  const valores = linhas.map((linha) => {
    const marcadores = colunas.map((c, i) => {
      params.push(linha[i])
      return `$${params.length}::${id(c.tipo)}`
    })
    return `(${marcadores.join(', ')})`
  })
  const sql =
    `INSERT INTO ${id(tabela)} (${colunas.map((c) => id(c.coluna)).join(', ')}) ` +
    `VALUES ${valores.join(', ')} ON CONFLICT DO NOTHING`
  return { sql, params }
}

/** Acerta a sequência de colunas autoincrement depois da cópia (o próximo id vem depois do maior copiado). */
export function sqlAjusteSequencia(tabela: string, coluna: string) {
  const literal = (s: string) => `'${s.replace(/'/g, "''")}'`
  return (
    `SELECT setval(pg_get_serial_sequence(${literal(id(tabela))}, ${literal(coluna)}), ` +
    `COALESCE(MAX(${id(coluna)}), 1), MAX(${id(coluna)}) IS NOT NULL) FROM ${id(tabela)}`
  )
}

export const idMysql = (nome: string) => `\`${nome.replace(/`/g, '``')}\``
