/** Mostra vínculos antigos sem recolocar planos inativos no catálogo público. */
export function incluirPlanosVinculados(ativos: { id: string; name: string }[], vinculados: { id: string; name?: string }[]) {
  const ids = new Set(ativos.map(p => p.id))
  return [...ativos, ...vinculados.filter(p => !ids.has(p.id)).map(p => ({ id: p.id, name: `${p.name || 'Plano de saúde'} (inativo)` }))]
}
