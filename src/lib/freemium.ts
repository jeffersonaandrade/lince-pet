/** Gratuidade é por perfil individual; clínicas e exames têm regras próprias. */
export const LIMITE_GRATUITO_MENSAL = 5
export const codigoPlanoIndividual = (codigo: string | null | undefined) =>
  !codigo || codigo === 'none' ? 'free' : codigo

export const limitePlanoIndividual = (codigo: string | null | undefined, limite: number | null) =>
  codigoPlanoIndividual(codigo) === 'free' ? LIMITE_GRATUITO_MENSAL : limite
