/** Política comum aos perfis profissionais. Não depende de banco, HTTP ou UI. */
export type IntervaloAgenda = { inicio: number; fim: number; deslocamentoMin: number }
export const STATUS_RESERVAM_AGENDA = ['pendente', 'confirmado', 'em andamento', 'em_andamento', 'agendado', 'marcado', 'confirmada']

export function intervalosConflitam(a: IntervaloAgenda, b: IntervaloAgenda) {
  // O intervalo entre dois atendimentos deve satisfazer ambos, sem somar buffers.
  const deslocamento = Math.max(a.deslocamentoMin, b.deslocamentoMin) * 60_000
  if (a.inicio < b.fim && b.inicio < a.fim) return true
  const intervalo = a.fim <= b.inicio ? b.inicio - a.fim : a.inicio - b.fim
  return intervalo < deslocamento
}

export type ModalidadeConsulta = 'presencial' | 'online' | 'domicilio'
export function modalidadeConsulta(value: unknown): ModalidadeConsulta | null {
  return value === 'presencial' || value === 'online' || value === 'domicilio' ? value : null
}
