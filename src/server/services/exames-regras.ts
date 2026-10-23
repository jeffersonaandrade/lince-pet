/** Regras puras da clínica de exames (sem banco), para o serviço e os testes. */

export const PASSO_EXAME_MIN = 30
const DIAS = ['domingo', 'segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado'] as const

const minutos = (hhmm: string) => {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim())
  return m ? Number(m[1]) * 60 + Number(m[2]) : null
}
export const paraHHmm = (min: number) =>
  `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`

const normalizarDia = (dia: string) =>
  dia.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace('-feira', '').trim()

/**
 * Blocos de 30 min em que a clínica abre no dia (`weekday` do Luxon: 1 = segunda ... 7 = domingo).
 * `horariosFuncionamento` vem em dois formatos: lista de inícios de slot (`["08:00","08:30"]`, salvo pelo
 * painel) ou faixa em texto (`"08:00-18:00"`, `"Fechado"`).
 */
export function blocosAbertos(horarios: unknown, weekday: number): Set<number> {
  let grade = horarios
  if (typeof grade === 'string') {
    try {
      grade = JSON.parse(grade)
    } catch {
      return new Set()
    }
  }
  if (!grade || typeof grade !== 'object' || Array.isArray(grade)) return new Set()
  const alvo = DIAS[weekday % 7]
  const abertos = new Set<number>()
  for (const [dia, valor] of Object.entries(grade as Record<string, unknown>)) {
    if (normalizarDia(dia) !== alvo) continue
    if (Array.isArray(valor)) {
      for (const h of valor) {
        const m = typeof h === 'string' ? minutos(h) : null
        if (m !== null) abertos.add(m - (m % PASSO_EXAME_MIN))
      }
    } else if (typeof valor === 'string') {
      const [ini, fim] = valor.split('-').map((p) => minutos(p))
      if (ini == null || fim == null) continue
      for (let m = ini; m + PASSO_EXAME_MIN <= fim; m += PASSO_EXAME_MIN) abertos.add(m)
    }
  }
  return abertos
}

/** O exame inteiro (início + duração) cabe em blocos abertos seguidos. */
export function cabeNoExpediente(abertos: Set<number>, inicioMin: number, duracaoMin: number) {
  if (inicioMin % PASSO_EXAME_MIN !== 0 || duracaoMin <= 0) return false
  for (let m = inicioMin; m < inicioMin + duracaoMin; m += PASSO_EXAME_MIN) {
    if (!abertos.has(m)) return false
  }
  return true
}

export const inicioDoBloco = (hhmm: string) => minutos(hhmm)

type Janela = { inicio: Date; fim: Date }
export type Ocupacao = Janela & { exameIds: string[] }

const sobrepoe = (a: Janela, b: Janela) => a.inicio < b.fim && a.fim > b.inicio

/**
 * Capacidade por exame: no mesmo horário cabem até `capacidade` agendamentos com aquele exame.
 * Devolve o nome do primeiro exame lotado, ou null se todos têm vaga.
 */
export function exameLotado(
  pedidos: { id: string; nome: string; capacidade: number }[],
  ocupacoes: Ocupacao[],
  janela: Janela
): string | null {
  const concorrentes = ocupacoes.filter((o) => sobrepoe(o, janela))
  for (const exame of pedidos) {
    const usados = concorrentes.filter((o) => o.exameIds.includes(exame.id)).length
    if (usados >= Math.max(1, exame.capacidade)) return exame.nome
  }
  return null
}

type ExameBase = { id: string; clinicaId: string; ativo: number; nome: string; preco: unknown; duracaoMin: number }

/** Combo: pelo menos 2 exames diferentes, ativos e da mesma clínica. */
export function motivoComboInvalido(clinicaId: string, exameIds: string[], exames: ExameBase[]): string | null {
  const unicos = [...new Set(exameIds)]
  if (unicos.length < 2) return 'O combo precisa de pelo menos 2 exames diferentes'
  const porId = new Map(exames.map((e) => [e.id, e]))
  for (const id of unicos) {
    const e = porId.get(id)
    if (!e || e.clinicaId !== clinicaId) return 'O combo só pode ter exames desta clínica'
    if (!e.ativo) return `O exame "${e.nome}" está inativo`
  }
  return null
}

/** Preço do pedido: combo usa o preço do combo; exames avulsos somam os preços. Duração soma sempre. */
export function totaisDoPedido(exames: Pick<ExameBase, 'preco' | 'duracaoMin'>[], precoCombo?: unknown) {
  const duracaoMin = exames.reduce((s, e) => s + e.duracaoMin, 0)
  const preco = precoCombo != null ? Number(precoCombo) : exames.reduce((s, e) => s + Number(e.preco), 0)
  return { duracaoMin, preco: Number(preco.toFixed(2)) }
}

/** Exames da clínica aparecem na busca: módulo ligado, RT aprovado e plano com exames. */
export const clinicaVisivelNosExames = (c: { examesAtivo: number; rtStatus: string | null }, temPlano: boolean) =>
  c.examesAtivo === 1 && c.rtStatus === 'aprovado' && temPlano
