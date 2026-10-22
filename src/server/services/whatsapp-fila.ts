import 'server-only'
import { DateTime } from 'luxon'
import { prisma } from '../db'
import { updating } from '../lucid'
import { FUSO_CONSULTA, inicioDaConsulta } from './agendamentos'
import { providerAtual } from './whatsapp'
import { STATUS_ATIVOS } from './whatsapp-lembretes'
import { entregar, referenciaDaConsulta } from './whatsapp-notificacoes'

/**
 * Conciliação da fila `whatsapp_envios` (roda no cron dos lembretes, a cada ~15 min).
 * - `aceito` parado: pergunta ao gateway; confirma, marca falha ou, se ele perdeu a mensagem, reenvia;
 * - `processando` parado (app caiu no meio do envio): reenvia;
 * - `falhou` por erro temporário: reenvia.
 * Reenvio só até LIMITE_TENTATIVAS e enquanto o aviso fizer sentido (ver `avisoAindaValido`).
 */

export const LIMITE_TENTATIVAS = 3
export const ACEITO_PARADO_MIN = 2
export const PROCESSANDO_PARADO_MIN = 5
const LOTE = 50

/** Avisos presos à data/hora: se a consulta foi remarcada depois, o texto antigo está errado. */
const EVENTOS_DA_DATA = new Set(['confirmacao', 'novo_agendamento', 'lembrete_24h', 'lembrete_2h', 'remarcacao'])

const select = {
  id: true,
  evento: true,
  referencia: true,
  telefone: true,
  mensagem: true,
  status: true,
  tentativas: true,
  provider: true,
  providerMessageId: true,
  updatedAt: true,
  agendamento: { select: { status: true, dataConsulta: true, horarioConsulta: true } },
} as const

type EnvioNaFila = {
  id: string
  evento: string
  referencia: string
  telefone: string | null
  mensagem: string | null
  status: string
  tentativas: number
  provider: string | null
  providerMessageId: string | null
  updatedAt: Date | null
  agendamento: { status: string | null; dataConsulta: string | null; horarioConsulta: string | null } | null
}

export type ResumoConciliacao = { conferidas: number; confirmadas: number; reenviadas: number; falhas: number; expiradas: number }

/**
 * O aviso ainda serve: consulta no futuro e, para avisos da data, consulta ativa com a mesma data/hora de quando o
 * texto foi gerado; lembrete 24h não sai dentro da janela do 2h.
 */
export function avisoAindaValido(envio: Pick<EnvioNaFila, 'evento' | 'referencia' | 'agendamento'>, agora: DateTime) {
  const a = envio.agendamento
  if (!a?.dataConsulta || !a.horarioConsulta) return false
  const inicio = inicioDaConsulta(a.dataConsulta, a.horarioConsulta)
  if (!inicio.isValid) return false
  const horasAte = inicio.diff(agora, 'hours').hours
  if (horasAte <= 0) return false
  if (envio.evento === 'lembrete_24h' && horasAte <= 2) return false
  if (EVENTOS_DA_DATA.has(envio.evento)) {
    if (!STATUS_ATIVOS.includes(a.status ?? '')) return false
    if (envio.referencia !== referenciaDaConsulta(a)) return false
  }
  return true
}

/** Atualiza só se a linha não mudou desde a leitura (outra execução do cron pode ter pego). */
async function marcar(envio: EnvioNaFila, data: Record<string, unknown>) {
  const { count } = await prisma.whatsappEnvio.updateMany({
    where: { id: envio.id, status: envio.status, updatedAt: envio.updatedAt },
    data: updating(data),
  })
  return count > 0
}

async function reenviar(envio: EnvioNaFila, agora: DateTime): Promise<keyof ResumoConciliacao | null> {
  if (envio.tentativas >= LIMITE_TENTATIVAS) {
    return (await marcar(envio, { status: 'falhou', motivo: 'limite_tentativas' })) ? 'falhas' : null
  }
  if (!envio.mensagem || !envio.telefone) {
    return (await marcar(envio, { status: 'falhou', motivo: 'erro', erro: 'Sem mensagem guardada para reenviar' })) ? 'falhas' : null
  }
  if (!avisoAindaValido(envio, agora)) {
    return (await marcar(envio, { status: 'falhou', motivo: 'expirado' })) ? 'expiradas' : null
  }
  if (!(await marcar(envio, { status: 'processando' }))) return null

  const r = await entregar({ id: envio.id, telefone: envio.telefone, tentativas: envio.tentativas }, envio.mensagem)
  return r.ok ? 'reenviadas' : 'falhas'
}

export async function conciliarEnvios(agora = DateTime.now().setZone(FUSO_CONSULTA)): Promise<ResumoConciliacao> {
  const resumo: ResumoConciliacao = { conferidas: 0, confirmadas: 0, reenviadas: 0, falhas: 0, expiradas: 0 }
  const corte = (minutos: number) => agora.minus({ minutes: minutos }).toJSDate()
  const provider = providerAtual()

  const pendentes: EnvioNaFila[] = await prisma.whatsappEnvio.findMany({
    where: {
      OR: [
        { status: 'aceito', updatedAt: { lt: corte(ACEITO_PARADO_MIN) } },
        { status: 'processando', updatedAt: { lt: corte(PROCESSANDO_PARADO_MIN) } },
        { status: 'falhou', motivo: 'erro_temporario' },
      ],
    },
    select,
    orderBy: { updatedAt: 'asc' },
    take: LOTE,
  })

  for (const envio of pendentes) {
    try {
      if (envio.status === 'aceito' && envio.providerMessageId) {
        // Sem como perguntar (provedor trocado ou síncrono): deixa como está.
        if (envio.provider !== provider.nome || !provider.consultar) continue
        resumo.conferidas++
        const situacao = await provider.consultar(envio.providerMessageId)
        if (situacao === 'pendente') continue
        if (situacao === 'enviada') {
          if (await marcar(envio, { status: 'enviado' })) resumo.confirmadas++
          continue
        }
        if (situacao === 'falhou') {
          const marcado = await marcar(envio, { status: 'falhou', motivo: 'erro_temporario', erro: 'Gateway não conseguiu entregar' })
          if (marcado) resumo.falhas++
          continue
        }
      }
      const resultado = await reenviar(envio, agora)
      if (resultado) resumo[resultado]++
    } catch (error) {
      console.error(`[WhatsApp] Erro ao conciliar envio ${envio.id}:`, error)
    }
  }

  return resumo
}
