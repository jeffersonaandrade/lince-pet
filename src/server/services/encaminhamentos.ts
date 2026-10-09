import 'server-only'
import { after } from 'next/server'
import vine from '@vinejs/vine'
import type { Prisma } from '@prisma/client'
import { prisma, type Usuario } from '../db'
import { HttpError } from '../http'
import { creating, updating } from '../lucid'
import type { CurrentUser } from '../auth/session'
import { nomeCompleto } from './agendamentos'
import { podeAnotar } from './anotacoes'
import { inAppNotifications } from './in-app-notifications'
import { notifications } from './notifications'
import { podeEnviarEmail } from './canais-notificacao'
import { notificarTutorAvulso } from './whatsapp-notificacoes'

/**
 * Encaminhamento do pet a partir de uma consulta, para outra clínica, veterinário ou prestador.
 * - Envia só o vet ou a clínica da consulta, a partir do início do atendimento e nunca em consulta cancelada.
 * - O destino aceita ou recusa (recusa exige motivo); enquanto enviado ou aceito, o destino vê o prontuário.
 * - Quem marca o horário é o tutor: o agendamento no destino segue as regras normais e fica ligado ao encaminhamento.
 */

export const DESTINO_TIPOS = ['veterinario', 'clinica', 'prestador'] as const
export const URGENCIAS = ['rotina', 'prioritario'] as const
export type DestinoTipo = (typeof DESTINO_TIPOS)[number]
export type StatusEncaminhamento = 'enviado' | 'aceito' | 'recusado'

export const MAX_MOTIVO = 2000
export const MIN_MOTIVO_RECUSA = 3
export const MENSAGEM_ANTES_DO_ATENDIMENTO = 'O encaminhamento fica disponível a partir do início do atendimento'
const STATUS_COM_ACESSO: StatusEncaminhamento[] = ['enviado', 'aceito']

const erro = (message: string, status = 400) => new HttpError(status, { status, message })

const CAMPO_DESTINO = {
  veterinario: 'destinoVeterinarioId',
  clinica: 'destinoClinicaId',
  prestador: 'destinoPrestadorId',
} as const satisfies Record<DestinoTipo, keyof Prisma.EncaminhamentoWhereInput>

export const encaminhamentoValidator = vine.compile(
  vine.object({
    destino_tipo: vine.enum(DESTINO_TIPOS),
    destino_id: vine.string().trim(),
    motivo: vine.string().trim().minLength(3).maxLength(MAX_MOTIVO),
    urgencia: vine.enum(URGENCIAS).optional(),
  })
)

/* --------------------------------- quem é quem -------------------------------- */

/** Filtro dos encaminhamentos recebidos pelo usuário; null se o tipo não recebe. */
export function destinoDoUsuario(user: CurrentUser): Prisma.EncaminhamentoWhereInput | null {
  if (user.userType === 'veterinario' && user.veterinario) return { destinoVeterinarioId: user.veterinario.id }
  if (user.userType === 'clinica' && user.clinica) return { destinoClinicaId: user.clinica.id }
  if (user.userType === 'prestador' && user.prestador) return { destinoPrestadorId: user.prestador.id }
  return null
}

function origemDoUsuario(user: CurrentUser) {
  if (user.userType === 'veterinario' && user.veterinario) {
    return { agendamento: { veterinarioId: user.veterinario.id }, enviados: { origemVeterinarioId: user.veterinario.id } }
  }
  if (user.userType === 'clinica' && user.clinica) {
    return { agendamento: { clinicaId: user.clinica.id }, enviados: { origemClinicaId: user.clinica.id } }
  }
  throw erro('Só veterinário ou clínica podem encaminhar', 403)
}

const ehOProprio = (user: CurrentUser, tipo: DestinoTipo, id: string) =>
  (tipo === 'veterinario' && user.veterinario?.id === id) || (tipo === 'clinica' && user.clinica?.id === id)

function destinoAtivo(tipo: DestinoTipo, id: string) {
  const user = { ativo: 1 }
  if (tipo === 'veterinario') return prisma.veterinario.findFirst({ where: { id, user }, select: { id: true } })
  if (tipo === 'clinica') return prisma.clinica.findFirst({ where: { id, user }, select: { id: true } })
  return prisma.prestador.findFirst({ where: { id, onboardingComplete: 1, user }, select: { id: true } })
}

/* ---------------------------------- dados ---------------------------------- */

const include = {
  pet: true,
  tutor: { include: { user: true } },
  agendamentoOrigem: { select: { id: true, dataConsulta: true, horarioConsulta: true, tipoConsulta: true } },
  origemVeterinario: { include: { user: true } },
  origemClinica: { include: { user: true } },
  destinoVeterinario: { include: { user: true } },
  destinoClinica: { include: { user: true } },
  destinoPrestador: { include: { user: true, tipoServico: true } },
  agendamentoDestino: { select: { id: true, status: true, dataConsulta: true, horarioConsulta: true } },
} satisfies Prisma.EncaminhamentoInclude

const buscar = (where: Prisma.EncaminhamentoWhereInput) => prisma.encaminhamento.findFirst({ where, include })
export type EncaminhamentoCompleto = NonNullable<Awaited<ReturnType<typeof buscar>>>

const nomeOuNull = (u?: Usuario | null) => (u ? nomeCompleto(u) : null)

export function destinoDe(e: EncaminhamentoCompleto) {
  const tipo = e.destinoTipo as DestinoTipo
  if (tipo === 'clinica') {
    const c = e.destinoClinica
    return {
      tipo,
      id: e.destinoClinicaId,
      nome: c?.nomeClinica || c?.nomeFantasia || nomeOuNull(c?.user) || 'Clínica',
      rotulo: 'Clínica',
      foto_url: c?.fotoPerfil || c?.user?.profilePic || null,
      user: c?.user ?? null,
      link: `/clinicas/${e.destinoClinicaId}`,
    }
  }
  if (tipo === 'prestador') {
    const p = e.destinoPrestador
    return {
      tipo,
      id: e.destinoPrestadorId,
      nome: nomeOuNull(p?.user) || 'Profissional',
      rotulo: p?.tipoServico?.nome || 'Profissional pet',
      foto_url: p?.fotoUrl || p?.user?.profilePic || null,
      user: p?.user ?? null,
      link: `/profissionais/${e.destinoPrestadorId}`,
    }
  }
  const v = e.destinoVeterinario
  return {
    tipo,
    id: e.destinoVeterinarioId,
    nome: nomeOuNull(v?.user) || 'Veterinário(a)',
    rotulo: 'Veterinário(a)',
    foto_url: v?.fotoUrl || v?.user?.profilePic || null,
    user: v?.user ?? null,
    link: `/veterinario/${e.destinoVeterinarioId}`,
  }
}

export function origemDe(e: EncaminhamentoCompleto) {
  const veterinario = nomeOuNull(e.origemVeterinario?.user)
  const clinica = e.origemClinica?.nomeClinica || e.origemClinica?.nomeFantasia || null
  return {
    nome: veterinario ? `Dr(a). ${veterinario}` : clinica || 'Profissional',
    veterinario_nome: veterinario,
    clinica_nome: clinica,
    users: [e.origemVeterinario?.user, e.origemClinica?.user].filter((u): u is Usuario => Boolean(u)),
  }
}

export function serializarEncaminhamento(e: EncaminhamentoCompleto) {
  const { user: _destinoUser, ...destino } = destinoDe(e)
  const { users: _origemUsers, ...origem } = origemDe(e)
  void _destinoUser
  void _origemUsers
  return {
    id: e.id,
    status: e.status as StatusEncaminhamento,
    urgencia: e.urgencia,
    motivo: e.motivo,
    motivo_recusa: e.motivoRecusa,
    criado_em: e.createdAt?.toISOString() ?? null,
    respondido_em: e.respondidoEm?.toISOString() ?? null,
    pet: e.pet ? { id: e.pet.id, nome: e.pet.nome, especie: e.pet.especie, raca: e.pet.raca } : null,
    tutor: e.tutor?.user ? { nome: nomeCompleto(e.tutor.user) } : null,
    origem: {
      ...origem,
      agendamento_id: e.agendamentoOrigemId,
      data_consulta: e.agendamentoOrigem?.dataConsulta ?? null,
    },
    destino,
    agendamento_destino: e.agendamentoDestino
      ? {
          id: e.agendamentoDestino.id,
          status: e.agendamentoDestino.status,
          data: e.agendamentoDestino.dataConsulta,
          horario: e.agendamentoDestino.horarioConsulta,
        }
      : null,
  }
}

const ordem = [{ createdAt: 'desc' as const }]

/* ---------------------------------- envio ---------------------------------- */

/** Vet ou clínica da consulta encaminham o pet. */
export async function criarEncaminhamento(user: CurrentUser, agendamentoId: string, body: unknown) {
  const origem = origemDoUsuario(user)
  const agendamento = await prisma.agendamento.findFirst({ where: { id: agendamentoId, ...origem.agendamento } })
  if (!agendamento) throw erro('Consulta não encontrada', 404)
  if (!agendamento.petId || !agendamento.tutorId) throw erro('Consulta sem pet vinculado')
  if (!podeAnotar(agendamento)) throw erro(MENSAGEM_ANTES_DO_ATENDIMENTO)

  const d = await encaminhamentoValidator.validate(body)
  if (ehOProprio(user, d.destino_tipo, d.destino_id)) throw erro('Escolha um destino diferente de você')
  if (!(await destinoAtivo(d.destino_tipo, d.destino_id))) throw erro('Destino não encontrado', 404)

  const campo = CAMPO_DESTINO[d.destino_tipo]
  const duplicado = await prisma.encaminhamento.findFirst({
    where: { agendamentoOrigemId: agendamento.id, status: 'enviado', [campo]: d.destino_id },
    select: { id: true },
  })
  if (duplicado) throw erro('Já existe um encaminhamento aguardando resposta deste destino', 409)

  const criado = await prisma.encaminhamento.create({
    data: creating({
      petId: agendamento.petId,
      tutorId: agendamento.tutorId,
      agendamentoOrigemId: agendamento.id,
      origemVeterinarioId: agendamento.veterinarioId,
      origemClinicaId: agendamento.clinicaId,
      destinoTipo: d.destino_tipo,
      [campo]: d.destino_id,
      motivo: d.motivo,
      urgencia: d.urgencia ?? 'rotina',
      status: 'enviado',
    }),
    include,
  })
  after(() => avisarEncaminhamento('novo', criado.id))
  return serializarEncaminhamento(criado)
}

export async function listarEnviados(user: CurrentUser, agendamentoId?: string | null) {
  const { enviados } = origemDoUsuario(user)
  const lista = await prisma.encaminhamento.findMany({
    where: { ...enviados, ...(agendamentoId ? { agendamentoOrigemId: agendamentoId } : {}) },
    include,
    orderBy: ordem,
  })
  return lista.map(serializarEncaminhamento)
}

export async function listarRecebidos(user: CurrentUser, status?: string | null) {
  const destino = destinoDoUsuario(user)
  if (!destino) throw erro('Tipo de conta não recebe encaminhamentos', 403)
  const lista = await prisma.encaminhamento.findMany({
    where: { ...destino, ...(status ? { status } : {}) },
    include,
    orderBy: ordem,
  })
  return lista.map(serializarEncaminhamento)
}

export async function listarDoTutor(tutorId: string) {
  const lista = await prisma.encaminhamento.findMany({ where: { tutorId }, include, orderBy: ordem })
  return lista.map(serializarEncaminhamento)
}

/* --------------------------------- resposta -------------------------------- */

async function recebidoPendente(user: CurrentUser, id: string) {
  const destino = destinoDoUsuario(user)
  if (!destino) throw erro('Encaminhamento não encontrado', 404)
  const e = await prisma.encaminhamento.findFirst({ where: { id, ...destino } })
  if (!e) throw erro('Encaminhamento não encontrado', 404)
  if (e.status !== 'enviado') throw erro('Este encaminhamento já foi respondido')
  return e
}

export async function aceitarEncaminhamento(user: CurrentUser, id: string) {
  await recebidoPendente(user, id)
  const e = await prisma.encaminhamento.update({
    where: { id },
    data: updating({ status: 'aceito', respondidoEm: new Date() }),
    include,
  })
  after(() => avisarEncaminhamento('aceito', id))
  return serializarEncaminhamento(e)
}

export async function recusarEncaminhamento(user: CurrentUser, id: string, motivo?: string | null) {
  const texto = String(motivo ?? '').trim()
  if (texto.length < MIN_MOTIVO_RECUSA) throw erro('Informe o motivo da recusa', 422)
  await recebidoPendente(user, id)
  const e = await prisma.encaminhamento.update({
    where: { id },
    data: updating({ status: 'recusado', motivoRecusa: texto.slice(0, 500), respondidoEm: new Date() }),
    include,
  })
  after(() => avisarEncaminhamento('recusado', id))
  return serializarEncaminhamento(e)
}

/* ------------------------------- agendamento ------------------------------- */

export type AlvoAgendamento = {
  tutorId: string
  petId: string
  veterinarioId?: string | null
  clinicaId?: string | null
  prestadorId?: string | null
}

const STATUS_CANCELADOS = ['cancelado', 'cancelada']

/**
 * Confere, antes de criar o agendamento, se o encaminhamento permite agendar este pet neste destino:
 * aceito, do mesmo tutor e pet, mesmo destino e ainda sem agendamento ativo.
 */
export async function conferirEncaminhamento(id: string, alvo: AlvoAgendamento) {
  const e = await prisma.encaminhamento.findUnique({
    where: { id },
    include: { agendamentoDestino: { select: { status: true } } },
  })
  if (!e || e.tutorId !== alvo.tutorId) throw erro('Encaminhamento não encontrado', 404)
  if (e.status !== 'aceito') throw erro('O encaminhamento precisa ser aceito antes de agendar')
  if (e.petId !== alvo.petId) throw erro('Este encaminhamento é de outro pet')
  if (e.agendamentoDestino && !STATUS_CANCELADOS.includes(e.agendamentoDestino.status)) {
    throw erro('Este encaminhamento já tem um agendamento', 409)
  }
  const tipo = e.destinoTipo as DestinoTipo
  const mesmoDestino =
    (tipo === 'veterinario' && Boolean(alvo.veterinarioId) && alvo.veterinarioId === e.destinoVeterinarioId) ||
    (tipo === 'clinica' && Boolean(alvo.clinicaId) && alvo.clinicaId === e.destinoClinicaId) ||
    (tipo === 'prestador' && Boolean(alvo.prestadorId) && alvo.prestadorId === e.destinoPrestadorId)
  if (!mesmoDestino) throw erro('O agendamento precisa ser com o destino do encaminhamento')
  return e
}

/** Liga o agendamento criado ao encaminhamento (o histórico mostra "Agendado"). */
export function vincularAgendamento(encaminhamentoId: string, agendamentoId: string) {
  return prisma.encaminhamento.update({
    where: { id: encaminhamentoId },
    data: updating({ agendamentoDestinoId: agendamentoId }),
  })
}

/* -------------------------------- prontuário ------------------------------- */

/** Destino de um encaminhamento enviado ou aceito do pet pode ver o prontuário. */
export async function recebeuEncaminhamentoDoPet(user: CurrentUser, petId: string) {
  const destino = destinoDoUsuario(user)
  if (!destino) return false
  const total = await prisma.encaminhamento.count({ where: { petId, status: { in: STATUS_COM_ACESSO }, ...destino } })
  return total > 0
}

export async function encaminhamentosAceitosDoPet(petId: string) {
  const lista = await prisma.encaminhamento.findMany({ where: { petId, status: 'aceito' }, include, orderBy: ordem })
  return lista.map(serializarEncaminhamento)
}

/* ---------------------------------- avisos --------------------------------- */

export type EventoEncaminhamento = 'novo' | 'aceito' | 'recusado'

type Texto = { titulo: string; mensagem: string }

async function avisarUsuario(user: Usuario, evento: EventoEncaminhamento, texto: Texto, e: EncaminhamentoCompleto) {
  try {
    await inAppNotifications.createGenericNotification({
      userId: user.id,
      type: `ENCAMINHAMENTO_${evento.toUpperCase()}`,
      title: texto.titulo,
      message: texto.mensagem,
      actionData: { encaminhamentoId: e.id, petId: e.petId },
    })
    if (podeEnviarEmail(user)) {
      await notifications.sendPedidoServico(user.email, texto.titulo, {
        titulo: texto.titulo,
        saudacao: `Olá, ${user.nome}!`,
        paragrafos: [texto.mensagem],
        detalhes: [
          ['Pet', e.pet?.nome ?? null],
          ['Encaminhado por', origemDe(e).nome],
          ['Destino', destinoDe(e).nome],
          ['Motivo', e.motivo],
          ['Urgência', e.urgencia === 'prioritario' ? 'Prioritário' : 'Rotina'],
        ],
      })
    }
  } catch (error) {
    console.error(`❌ [Encaminhamento] Erro ao avisar ${evento} (User ID: ${user.id}):`, error)
  }
}

/** In-app, e-mail e WhatsApp (tutor) do encaminhamento. Nunca lança. */
export async function avisarEncaminhamento(evento: EventoEncaminhamento, id: string) {
  try {
    const e = await buscar({ id })
    if (!e) return
    const destino = destinoDe(e)
    const origem = origemDe(e)
    const pet = e.pet?.nome || 'o pet'
    const tutor = e.tutor?.user ?? null

    if (evento === 'novo') {
      if (destino.user) {
        await avisarUsuario(destino.user, evento, {
          titulo: 'Novo encaminhamento',
          mensagem: `${origem.nome} encaminhou ${pet} para você. Motivo: ${e.motivo}. Aceite ou recuse no seu painel.`,
        }, e)
      }
      if (tutor) {
        await avisarUsuario(tutor, evento, {
          titulo: 'Encaminhamento enviado',
          mensagem: `${origem.nome} encaminhou ${pet} para ${destino.nome}. Avisaremos quando houver resposta.`,
        }, e)
      }
      return
    }

    const texto: Texto =
      evento === 'aceito'
        ? {
            titulo: 'Encaminhamento aceito',
            mensagem: `${destino.nome} aceitou o encaminhamento de ${pet}. Agende o atendimento pelo seu painel.`,
          }
        : {
            titulo: 'Encaminhamento recusado',
            mensagem: `${destino.nome} não poderá receber ${pet}. Motivo: ${e.motivoRecusa ?? ''}`.trim(),
          }
    if (tutor) await avisarUsuario(tutor, evento, texto, e)
    for (const u of origem.users) await avisarUsuario(u, evento, texto, e)
    await notificarTutorAvulso(
      e.agendamentoOrigemId,
      `encaminhamento_${evento}`,
      e.id.slice(0, 20),
      `Olá! ${texto.mensagem}\n\n_Lince Pet: avisos automáticos. Para não receber, desative no seu perfil._`
    )
  } catch (error) {
    console.error(`❌ [Encaminhamento] Erro geral ao avisar ${evento}:`, error)
  }
}
