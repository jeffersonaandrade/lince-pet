import 'server-only'
import { Prisma } from '@/generated/prisma/client'
import { prisma } from '../db'
import { creating, updating } from '../lucid'
import { nomeCompleto } from './agendamentos'
import { hasFeature } from './subscription'
import { canaisDe } from './canais-notificacao'
import { profissionalDe } from './profissional'
import { enviarComRetry, normalizarTelefoneE164, providerAtual } from './whatsapp'
import { montarMensagem, type Destinatario, type EventoWhatsapp } from './whatsapp-mensagens'

/**
 * Orquestra os avisos de WhatsApp do agendamento. Regras: plano do vet, do prestador ou da clínica com
 * `whatsapp_notifications`, canal WhatsApp ligado por quem recebe (tutor ou vet), celular válido e envio único por
 * (agendamento, evento, destinatário, referência). Nunca lança erro: tudo vai para `whatsapp_envios`, que é a fila
 * oficial (texto guardado em `mensagem`; a conciliação em `whatsapp-fila.ts` confirma e reenvia).
 */

export const FEATURE_WHATSAPP = 'whatsapp_notifications'

export type ResultadoEnvio = 'enviado' | 'falhou' | 'ignorado' | 'duplicado' | 'nao_aplicavel'

const include = {
  tutor: { include: { user: true } },
  pet: true,
  veterinario: { include: { user: true } },
  prestador: { include: { user: true, tipoServico: true } },
  servicoOferecido: true,
  clinica: true,
} satisfies Prisma.AgendamentoInclude

export const carregarAgendamento = (id: string) => prisma.agendamento.findUnique({ where: { id }, include })

export type AgendamentoWhatsapp = NonNullable<Awaited<ReturnType<typeof carregarAgendamento>>>

/** Data + hora da consulta no envio: remarcar muda a referência e libera novos lembretes. */
export const referenciaDaConsulta = (a: Pick<AgendamentoWhatsapp, 'dataConsulta' | 'horarioConsulta'>) =>
  `${(a.dataConsulta || '').slice(0, 10)} ${a.horarioConsulta || ''}`.trim()

const formatarData = (iso?: string | null) => (iso ? iso.slice(0, 10).split('-').reverse().join('/') : '')

export async function planoPermiteWhatsapp(a: AgendamentoWhatsapp) {
  if (a.veterinario && (await hasFeature(a.veterinario, FEATURE_WHATSAPP))) return true
  if (a.prestador && (await hasFeature(a.prestador, FEATURE_WHATSAPP))) return true
  return Boolean(a.clinica && (await hasFeature(a.clinica, FEATURE_WHATSAPP)))
}

function telefoneDe(a: AgendamentoWhatsapp, para: Destinatario) {
  if (para === 'tutor') return normalizarTelefoneE164(a.tutor?.user?.celular)
  return normalizarTelefoneE164(profissionalDe(a).user?.celular) || normalizarTelefoneE164(a.clinica?.whatsapp)
}

export function dadosDaMensagem(a: AgendamentoWhatsapp, motivo?: string | null) {
  return {
    tutor: a.tutor?.user ? nomeCompleto(a.tutor.user) : 'Tutor',
    pet: a.pet?.nome || 'seu pet',
    profissional: profissionalDe(a).nome,
    data: formatarData(a.dataConsulta),
    hora: a.horarioConsulta || '',
    local: a.localNome || a.localEndereco || a.tipoConsulta || 'a combinar',
    motivo,
    servico: a.prestador ? a.servicoOferecido?.nome || a.prestador.tipoServico?.nome || 'Serviço' : null,
  }
}

const isDuplicado = (e: unknown) => e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002'

/** Reserva o envio (unique de idempotência); null se já foi registrado antes. */
async function reservar(data: {
  agendamentoId: string
  evento: string
  destinatario: Destinatario
  referencia: string
  telefone: string | null
  status: string
  motivo?: string | null
  mensagem?: string
}) {
  try {
    return await prisma.whatsappEnvio.create({ data: creating({ ...data, tentativas: 0 }) })
  } catch (e) {
    if (isDuplicado(e)) return null
    throw e
  }
}

async function enviarPara(
  a: AgendamentoWhatsapp,
  evento: EventoWhatsapp,
  para: Destinatario,
  planoOk: boolean,
  motivo?: string | null
): Promise<ResultadoEnvio> {
  const texto = montarMensagem(evento, para, dadosDaMensagem(a, motivo))
  if (!texto) return 'nao_aplicavel'
  return despachar(a, evento, para, referenciaDaConsulta(a), texto, planoOk)
}

async function despachar(
  a: AgendamentoWhatsapp,
  evento: string,
  para: Destinatario,
  referencia: string,
  texto: string,
  planoOk: boolean
): Promise<ResultadoEnvio> {
  const base = {
    agendamentoId: a.id,
    evento,
    destinatario: para,
    referencia,
    telefone: telefoneDe(a, para),
  }

  const quemRecebe = para === 'tutor' ? a.tutor?.user : profissionalDe(a).user
  const motivoIgnorado = !planoOk
    ? 'sem_plano'
    : quemRecebe && !canaisDe(quemRecebe).whatsapp
      ? 'opt_out'
      : !base.telefone
        ? 'sem_celular'
        : null

  if (motivoIgnorado) {
    const registro = await reservar({ ...base, status: 'ignorado', motivo: motivoIgnorado })
    return registro ? 'ignorado' : 'duplicado'
  }

  const registro = await reservar({ ...base, status: 'processando', mensagem: texto })
  if (!registro) return 'duplicado'

  const r = await entregar({ id: registro.id, telefone: base.telefone!, tentativas: 0 }, texto)
  if (!r.ok) console.error(`[WhatsApp] Falha (${evento}/${para}) agendamento ${a.id}: ${r.erro}`)
  return r.ok ? 'enviado' : 'falhou'
}

/**
 * Envia uma linha já reservada e grava o resultado. Provedor assíncrono (gateway) fica `aceito` até a conciliação
 * confirmar. A chave de idempotência muda a cada rodada (`tentativas` só cresce), para o reenvio não reaproveitar
 * um job que o gateway já marcou como falho.
 */
export async function entregar(envio: { id: string; telefone: string; tentativas: number }, texto: string) {
  const provider = providerAtual()
  const r = await enviarComRetry(provider, envio.telefone, texto, { idempotencyKey: `${envio.id}:${envio.tentativas + 1}` })
  await prisma.whatsappEnvio.update({
    where: { id: envio.id },
    data: updating({
      provider: provider.nome,
      tentativas: envio.tentativas + r.tentativas,
      ...(r.ok
        ? { status: provider.assincrono ? 'aceito' : 'enviado', providerMessageId: r.id ?? null, motivo: null, erro: null }
        : { status: 'falhou', motivo: r.temporario ? 'erro_temporario' : 'erro', erro: r.erro }),
    }),
  })
  return r
}

/**
 * Texto avulso ao tutor ligado a um agendamento (ex.: encaminhamento a partir da consulta).
 * Mesmas regras de plano, canal e idempotência; `referencia` tem até 20 caracteres. Nunca lança erro.
 */
export async function notificarTutorAvulso(
  agendamentoId: string,
  evento: string,
  referencia: string,
  texto: string
): Promise<ResultadoEnvio> {
  try {
    const a = await carregarAgendamento(agendamentoId)
    if (!a) return 'nao_aplicavel'
    return await despachar(a, evento.slice(0, 30), 'tutor', referencia.slice(0, 20), texto, await planoPermiteWhatsapp(a))
  } catch (error) {
    console.error(`[WhatsApp] Erro no aviso avulso ${evento}:`, error)
    return 'falhou'
  }
}

/** Dispara o evento para os destinatários. Nunca lança erro. */
export async function notificarAgendamento(
  evento: EventoWhatsapp,
  agendamento: string | AgendamentoWhatsapp,
  destinatarios: Destinatario[],
  opts: { motivo?: string | null } = {}
): Promise<Partial<Record<Destinatario, ResultadoEnvio>>> {
  const resultado: Partial<Record<Destinatario, ResultadoEnvio>> = {}
  try {
    const a = typeof agendamento === 'string' ? await carregarAgendamento(agendamento) : agendamento
    if (!a) return resultado
    const planoOk = await planoPermiteWhatsapp(a)
    for (const para of destinatarios) {
      try {
        resultado[para] = await enviarPara(a, evento, para, planoOk, opts.motivo)
      } catch (error) {
        console.error(`[WhatsApp] Erro ao processar ${evento}/${para}:`, error)
        resultado[para] = 'falhou'
      }
    }
  } catch (error) {
    console.error(`[WhatsApp] Erro ao preparar ${evento}:`, error)
  }
  return resultado
}
