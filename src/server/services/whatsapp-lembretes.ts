import 'server-only'
import { timingSafeEqual } from 'node:crypto'
import { DateTime } from 'luxon'
import { prisma } from '../db'
import { env } from '../env'
import { FUSO_CONSULTA, inicioDaConsulta } from './agendamentos'
import { carregarAgendamento, notificarAgendamento, type ResultadoEnvio } from './whatsapp-notificacoes'
import type { EventoWhatsapp } from './whatsapp-mensagens'

/**
 * Lembretes ao tutor 24h e 2h antes. Rodar a cada ~15 min (rota /api/cron/lembretes-whatsapp).
 * Envio único por janela garantido pela unique de whatsapp_envios.
 */

const STATUS_ATIVOS = ['pendente', 'confirmado', 'agendado', 'marcado']

/** Authorization: Bearer CRON_SECRET. Sem CRON_SECRET configurado a rota fica fechada. */
export function cronAutorizado(authorization: string | null | undefined, secret = env('CRON_SECRET')) {
  if (!secret || !authorization) return false
  const esperado = Buffer.from(`Bearer ${secret}`)
  const recebido = Buffer.from(authorization)
  return esperado.length === recebido.length && timingSafeEqual(esperado, recebido)
}

/** Qual lembrete cabe agora; null se nenhum. Pula a janela se a consulta foi criada já dentro dela. */
export function lembreteDevido(
  inicio: DateTime,
  agora: DateTime,
  criadoEm: Date | null
): EventoWhatsapp | null {
  const horasAte = inicio.diff(agora, 'hours').hours
  if (horasAte <= 0 || horasAte > 24) return null

  const antecedenciaNaCriacao = criadoEm ? inicio.diff(DateTime.fromJSDate(criadoEm), 'hours').hours : Infinity
  if (horasAte <= 2) return antecedenciaNaCriacao > 2 ? 'lembrete_2h' : null
  return antecedenciaNaCriacao > 24 ? 'lembrete_24h' : null
}

export async function processarLembretes(agora = DateTime.now().setZone(FUSO_CONSULTA)) {
  const resumo = { processadas: 0, enviadas: 0, ignoradas: 0, falhas: 0, duplicadas: 0 }
  const hoje = agora.toISODate()!
  const limite = agora.plus({ days: 2 }).toISODate()!

  const candidatos = await prisma.agendamento.findMany({
    where: {
      status: { in: STATUS_ATIVOS },
      dataConsulta: { gte: hoje, lte: `${limite}\uffff` },
      horarioConsulta: { not: null },
    },
    select: { id: true, dataConsulta: true, horarioConsulta: true, createdAt: true },
  })

  const contar: Record<ResultadoEnvio, keyof typeof resumo | null> = {
    enviado: 'enviadas',
    ignorado: 'ignoradas',
    falhou: 'falhas',
    duplicado: 'duplicadas',
    nao_aplicavel: null,
  }

  for (const c of candidatos) {
    const inicio = inicioDaConsulta(c.dataConsulta!, c.horarioConsulta!)
    if (!inicio.isValid) continue
    const evento = lembreteDevido(inicio, agora, c.createdAt)
    if (!evento) continue

    resumo.processadas++
    const agendamento = await carregarAgendamento(c.id)
    if (!agendamento) continue
    const { tutor } = await notificarAgendamento(evento, agendamento, ['tutor'])
    const chave = tutor ? contar[tutor] : null
    if (chave) resumo[chave]++
  }

  return resumo
}
