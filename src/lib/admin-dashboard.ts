/** Números do painel admin. Sem nomes, e-mails ou outros dados pessoais. */
export type ContagemAgenda = {
  pendente: number
  confirmado: number
  emAndamento: number
  realizado: number
  cancelado: number
}

export type ContasAtivas = {
  tutor: number
  veterinario: number
  clinica: number
  prestador: number
}

export type PainelAdmin = {
  mes: string
  filas: { crmv: number; responsavelTecnico: number; recuperacoesCnpj: number }
  contas: ContasAtivas
  agenda: { consultas: ContagemAgenda; pedidos: ContagemAgenda }
  assinaturas: { total: number; porPlano: { codigo: string; quantidade: number }[] }
}

export const STATUS_AGENDA = ['pendente', 'confirmado', 'em andamento', 'realizado', 'cancelado'] as const

export function contagemAgenda(linhas: { status: string; quantidade: number }[]): ContagemAgenda {
  const base: ContagemAgenda = { pendente: 0, confirmado: 0, emAndamento: 0, realizado: 0, cancelado: 0 }
  for (const linha of linhas) {
    if (linha.status === 'pendente') base.pendente = linha.quantidade
    else if (linha.status === 'confirmado') base.confirmado = linha.quantidade
    else if (linha.status === 'em andamento') base.emAndamento = linha.quantidade
    else if (linha.status === 'realizado') base.realizado = linha.quantidade
    else if (linha.status === 'cancelado') base.cancelado = linha.quantidade
  }
  return base
}
