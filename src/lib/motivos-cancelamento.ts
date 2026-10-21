/**
 * Motivos que o tutor pode escolher ao cancelar. O tutor nunca escreve o texto: ele sai pelo
 * WhatsApp oficial da Lince Pet e por e-mail, então só textos padrão (evita phishing pelo nosso número).
 */
export const MOTIVOS_CANCELAMENTO_TUTOR = {
  imprevisto: 'Imprevisto do tutor',
  horario: 'O horário não é mais possível',
  pet_melhorou: 'O pet melhorou',
  outro_profissional: 'Vai atender com outro profissional',
  outro: 'Outro motivo',
} as const

export type MotivoCancelamentoTutor = keyof typeof MOTIVOS_CANCELAMENTO_TUTOR

export const MOTIVO_PADRAO_TUTOR = 'Cancelado pelo tutor'

/** Texto padrão do motivo escolhido; código desconhecido ou texto livre vira `null`. */
export function motivoDoTutor(codigo: unknown): string | null {
  return typeof codigo === 'string' && Object.hasOwn(MOTIVOS_CANCELAMENTO_TUTOR, codigo)
    ? MOTIVOS_CANCELAMENTO_TUTOR[codigo as MotivoCancelamentoTutor]
    : null
}
