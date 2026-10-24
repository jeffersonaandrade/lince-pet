/** Regras puras da assinatura (sem banco nem Asaas), para rotas, webhook e testes. */
import { timingSafeEqual } from 'node:crypto'

/** Planos que cada tipo pode contratar (vet e prestador dividem target `veterinario` por legado). */
export const PLANOS_POR_TIPO: Record<'veterinario' | 'clinica' | 'prestador', string[]> = {
  veterinario: ['vet_starter', 'vet_pro'],
  clinica: ['starter', 'clinic', 'clinic_pro'],
  prestador: ['free', 'pro'],
}

export const planoServePara = (code: string, tipo: keyof typeof PLANOS_POR_TIPO) => PLANOS_POR_TIPO[tipo].includes(code)

export type StatusAssinatura = 'active' | 'pending' | 'canceled' | 'past_due' | 'expired' | 'cancel_pending'
export type StatusLabel = 'ativa' | 'pendente' | 'cancelada' | 'inadimplente' | 'cancelamento_pendente'

const LABEL: Record<string, StatusLabel> = {
  active: 'ativa',
  pending: 'pendente',
  canceled: 'cancelada',
  expired: 'cancelada',
  past_due: 'inadimplente',
  cancel_pending: 'cancelamento_pendente',
}

export const statusLabel = (status: string | null | undefined): StatusLabel | null =>
  (status && LABEL[status]) || null

/** yyyy-mm-dd no fuso de Brasília (o Asaas vence por data local). */
export function dataLocal(d: Date) {
  return d.toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' })
}

export function somarDias(d: Date, dias: number) {
  const r = new Date(d)
  r.setDate(r.getDate() + dias)
  return r
}

/** Teste grátis só na primeira assinatura paga da conta. */
export const temDireitoAoTeste = (trialDays: number | null | undefined, jaTeveAssinaturaPaga: boolean) =>
  !jaTeveAssinaturaPaga && (trialDays ?? 0) > 0

/** Fim do período pago: vencimento da fatura + 1 mês (ciclo mensal); 31/01 vai a 28/02 (ou 29/02). */
export function fimDoPeriodo(dueDate: string) {
  const [y, m, d] = dueDate.split('-').map(Number)
  const ultimoDiaDoMes = new Date(Date.UTC(y, m + 1, 0)).getUTCDate()
  return new Date(Date.UTC(y, m, Math.min(d, ultimoDiaDoMes), 23, 59, 59))
}

/**
 * App em produção (NODE_ENV) ou ASAAS_ENV=production: token do webhook obrigatório. Só em desenvolvimento
 * com sandbox, sem token configurado, aceita (para testar com ngrok). Com token, o header
 * `asaas-access-token` precisa bater (comparação em tempo constante).
 */
export function webhookAutorizado(
  tokenConfigurado: string | undefined,
  tokenRecebido: string | null | undefined,
  asaasEnv: string | undefined,
  appEmProducao = false
) {
  if (!tokenConfigurado) return !appEmProducao && asaasEnv !== 'production'
  if (!tokenRecebido) return false
  const a = Buffer.from(tokenRecebido)
  const b = Buffer.from(tokenConfigurado)
  return a.length === b.length && timingSafeEqual(a, b)
}

/**
 * Módulo de exames: só planos pagos de clínica. Valor = exames agendados por mês (null = ilimitado).
 * Fica no código (não no banco) para valer em produção sem alterar dados dos planos.
 */
export const LIMITE_EXAMES_MES: Record<string, number | null> = { starter: 100, clinic: 300, clinic_pro: null }

export const planoComExames = (code: string | null | undefined) =>
  !!code && Object.prototype.hasOwnProperty.call(LIMITE_EXAMES_MES, code)

/** Inadimplência devolve a clínica ao plano padrão: os agendamentos feitos ficam, os novos param aqui. */
export function podeAgendarExame(code: string | null | undefined, agendadosNoMes: number) {
  if (!planoComExames(code)) return { ok: false as const, motivo: 'Esta clínica não está recebendo agendamentos de exames no momento.' }
  const limite = LIMITE_EXAMES_MES[code as string]
  if (limite != null && agendadosNoMes >= limite) {
    return { ok: false as const, motivo: 'Esta clínica atingiu o limite de exames do mês. Tente outra data ou outra clínica.' }
  }
  return { ok: true as const, motivo: null }
}

/** Vets que contam no limite da clínica: vínculos aceitos e convites pendentes. */
export function podeVincularVet(maxVeterinarios: number | null | undefined, vinculados: number, temPlano: boolean) {
  if (!temPlano) return { ok: false, motivo: 'Assine um plano para vincular veterinários à clínica.' }
  if (maxVeterinarios != null && vinculados >= maxVeterinarios) {
    return { ok: false, motivo: `Seu plano permite até ${maxVeterinarios} veterinários. Faça upgrade para vincular mais.` }
  }
  return { ok: true as const, motivo: null }
}
