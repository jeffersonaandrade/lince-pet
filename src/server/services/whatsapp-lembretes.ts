import 'server-only'
import { timingSafeEqual } from 'node:crypto'
import { DateTime } from 'luxon'
import { Prisma } from '@/generated/prisma/client'
import { prisma } from '../db'
import { env } from '../env'
import { now } from '../lucid'
import { FUSO_CONSULTA, inicioDaConsulta } from './agendamentos'
import { podeEnviarEmail } from './canais-notificacao'
import { inAppNotifications } from './in-app-notifications'
import { notifications } from './notifications'
import {
  carregarAgendamento,
  dadosDaMensagem,
  notificarAgendamento,
  referenciaDaConsulta,
  type AgendamentoWhatsapp,
  type ResultadoEnvio,
} from './whatsapp-notificacoes'
import type { EventoWhatsapp } from './whatsapp-mensagens'

/**
 * Lembretes ao tutor 24h e 2h antes, sem depender de plano. Rodar a cada ~15 min (rota /api/cron/lembretes-whatsapp).
 * Sino e navegador nos dois; e-mail só no de 24h (respeita o opt-out). Envio único por janela pela chave de
 * avisos_lembrete; o WhatsApp segue com a própria unique em whatsapp_envios.
 */

type EventoLembrete = Extract<EventoWhatsapp, 'lembrete_24h' | 'lembrete_2h'>

const isDuplicado = (e: unknown) => e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002'

/** Grava o lembrete; false se já tinha saído para esta data+hora. */
async function registrarAviso(agendamentoId: string, evento: EventoLembrete, referencia: string) {
  try {
    await prisma.avisoLembrete.create({ data: { agendamentoId, evento, referencia, createdAt: now() } })
    return true
  } catch (error) {
    if (isDuplicado(error)) return false
    throw error
  }
}

/** Sino + navegador (sempre) e e-mail (só 24h) ao tutor. Nunca lança; true se o lembrete saiu agora. */
export async function avisarLembrete(evento: EventoLembrete, a: AgendamentoWhatsapp) {
  const tutorUser = a.tutor?.user
  if (!tutorUser) return false
  try {
    if (!(await registrarAviso(a.id, evento, referenciaDaConsulta(a)))) return false
    const d = dadosDaMensagem(a)
    await inAppNotifications.notifyAppointmentReminderToTutor({
      tutorUserId: tutorUser.id,
      veterinarioNome: d.profissional,
      dataConsulta: d.data,
      horarioConsulta: d.hora,
      agendamentoId: a.id,
      quando: evento === 'lembrete_24h' ? 'amanha' : 'em_breve',
      petNome: a.pet?.nome,
      exames: d.exames,
      preparo: d.preparo,
    })
    if (evento === 'lembrete_24h' && podeEnviarEmail(tutorUser)) {
      await notifications.sendLembreteConsulta(tutorUser.email, {
        nomeTutor: tutorUser.nome,
        pet: d.pet,
        profissional: d.profissional,
        data: d.data,
        hora: d.hora,
        local: d.local,
        exames: d.exames,
        preparo: d.preparo,
      })
    }
    return true
  } catch (error) {
    console.error(`❌ [Lembretes] Falha no ${evento} do agendamento ${a.id}:`, error)
    return false
  }
}

export const STATUS_ATIVOS = ['pendente', 'confirmado', 'agendado', 'marcado']

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
): EventoLembrete | null {
  const horasAte = inicio.diff(agora, 'hours').hours
  if (horasAte <= 0 || horasAte > 24) return null

  const antecedenciaNaCriacao = criadoEm ? inicio.diff(DateTime.fromJSDate(criadoEm), 'hours').hours : Infinity
  if (horasAte <= 2) return antecedenciaNaCriacao > 2 ? 'lembrete_2h' : null
  return antecedenciaNaCriacao > 24 ? 'lembrete_24h' : null
}

export async function processarLembretes(agora = DateTime.now().setZone(FUSO_CONSULTA)) {
  const resumo = { processadas: 0, avisadas: 0, enviadas: 0, ignoradas: 0, falhas: 0, duplicadas: 0 }
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
    if (await avisarLembrete(evento, agendamento)) resumo.avisadas++
    const { tutor } = await notificarAgendamento(evento, agendamento, ['tutor'])
    const chave = tutor ? contar[tutor] : null
    if (chave) resumo[chave]++
  }

  return resumo
}
