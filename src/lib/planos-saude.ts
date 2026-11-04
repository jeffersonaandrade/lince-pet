/** Mostra vínculos antigos sem recolocar planos inativos no catálogo público. */
export function incluirPlanosVinculados(ativos: { id: string; name: string }[], vinculados: { id: string; name?: string }[]) {
  const ids = new Set(ativos.map(p => p.id))
  return [...ativos, ...vinculados.filter(p => !ids.has(p.id)).map(p => ({ id: p.id, name: `${p.name || 'Plano de saúde'} (inativo)` }))]
}

/** Sugestão de categorias por marca conhecida (só ajuda no formulário). */
export function exemploCategoriasPlano(nome: string): string {
  const n = nome
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
  if (n.includes('pet top')) return 'Ex.: Diamante, Premium, Gold'
  if (n.includes('eupet') || n.includes('eu pet')) return 'Ex.: Premium, Super, Safety'
  return 'Ex.: categorias/faixas que a clínica aceita neste plano'
}

/** Rótulo público: "Pet top — Diamante, Premium" ou só o nome. */
export function rotuloPlanoComCategorias(plano: { name: string; categoriasAceitas?: string | null }) {
  const cats = plano.categoriasAceitas?.trim()
  return cats ? `${plano.name} — ${cats}` : plano.name
}

const LIMITE_CATEGORIAS = 500

/** Aceita `string[]` (legado) ou `{ id, categoriasAceitas? }[]`. */
export function normalizarPlanosClinicaInput(planos: unknown): { id: string; categoriasAceitas: string | null }[] {
  if (!Array.isArray(planos)) return []
  const porId = new Map<string, string | null>()
  for (const item of planos) {
    if (typeof item === 'string' || typeof item === 'number') {
      const id = String(item)
      if (!porId.has(id)) porId.set(id, null)
      continue
    }
    if (!item || typeof item !== 'object') continue
    const raw = item as { id?: unknown; categoriasAceitas?: unknown; categorias_aceitas?: unknown }
    if (raw.id == null) continue
    const id = String(raw.id)
    const bruto = raw.categoriasAceitas ?? raw.categorias_aceitas
    const texto =
      typeof bruto === 'string'
        ? bruto.trim().slice(0, LIMITE_CATEGORIAS) || null
        : null
    porId.set(id, texto)
  }
  return [...porId.entries()].map(([id, categoriasAceitas]) => ({ id, categoriasAceitas }))
}
