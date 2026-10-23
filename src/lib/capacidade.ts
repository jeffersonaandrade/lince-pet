export type NivelCapacidade = 'normal' | 'atencao' | 'critico' | 'excedido'
export type MedicaoCapacidade = {
  bytes: number
  limiteBytes: number
  percentual: number
  livresBytes: number
  nivel: NivelCapacidade
}
export type TabelaCapacidade = { schema: string; nome: string; bytes: number; registrosEstimados: number }
export type CapacidadeAdmin = {
  consultadoEm: string
  referencia: { bancoMb: number; storageGb: number }
  banco: { status: 'disponivel' | 'indisponivel'; uso: MedicaoCapacidade | null; tabelas: TabelaCapacidade[] }
  storage: {
    status: 'disponivel' | 'parcial' | 'nao_configurado' | 'indisponivel'
    uso: MedicaoCapacidade | null
    objetos: number
    semTamanho: number
    buckets: { nome: string; bytes: number; objetos: number }[]
  }
}

export function medirCapacidade(bytes: number, limiteBytes: number): MedicaoCapacidade {
  if (!Number.isFinite(bytes) || bytes < 0 || !Number.isFinite(limiteBytes) || limiteBytes <= 0) {
    throw new Error('Medição de capacidade inválida')
  }
  const proporcao = bytes / limiteBytes
  return {
    bytes, limiteBytes,
    percentual: Math.round(proporcao * 1000) / 10,
    livresBytes: Math.max(0, limiteBytes - bytes),
    nivel: proporcao >= 1 ? 'excedido' : proporcao >= 0.9 ? 'critico' : proporcao >= 0.7 ? 'atencao' : 'normal',
  }
}

/** Unidades decimais explícitas, iguais às referências configuradas em MB e GB. */
export function formatarBytes(bytes: number) {
  const unidades = ['B', 'KB', 'MB', 'GB', 'TB']
  const indice = bytes > 0 ? Math.max(0, Math.min(Math.floor(Math.log10(bytes) / 3), unidades.length - 1)) : 0
  return `${new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 }).format(bytes / 1000 ** indice)} ${unidades[indice]}`
}
