import 'server-only'
import { after } from 'next/server'
import { randomInt } from 'node:crypto'
import { DateTime } from 'luxon'
import vine from '@vinejs/vine'
import type { BloqueioAgenda, Prisma, User } from '@prisma/client'
import { prisma } from '../db'
import { HttpError } from '../http'
import { creating, updating } from '../lucid'
import { FUSO_CONSULTA, nomeCompleto, podeSerCancelado, prepareDateTimeString } from './agendamentos'
import { bloqueioCobreData, horariosDoBloqueio, serializeBloqueio, validarBloqueio, type BloqueioInput } from './bloqueios'
import { canCreateAppointment, decrementUsage, incrementUsage } from './subscription'
import { inAppNotifications } from './in-app-notifications'
import { notifications } from './notifications'
import { podeEnviarEmail } from './canais-notificacao'
import { notificarAgendamento } from './whatsapp-notificacoes'
import { googleCalendar, type AcaoAgenda } from './google-calendar'
import type { Destinatario, EventoWhatsapp } from './whatsapp-mensagens'
import type { Modalidade } from './prestadores'

/**
 * Pedido de serviço a um prestador. Reaproveita `agendamentos` (prestadorId no lugar de veterinarioId)
 * com início e fim reais em `inicioEm`/`fimEm`:
 * - modalidade `duracao` (tosa, passeio, adestramento): fim = início + duração do serviço, dentro da grade do dia;
 * - modalidade `periodo` (hospedagem): entrada e saída em dias de atendimento, preço = diária × dias.
 * Não pode sobrepor outro pedido ativo nem cair em bloqueio. Sem prontuário nem anotação clínica.
 */

export type Grade = Record<string, [string, string]>
export type Periodo = { inicio: DateTime; fim: DateTime; dias: number }

export const STATUS_OCUPAM = ['pendente', 'confirmado', 'em andamento']
export const MAX_DIAS_HOSPEDAGEM = 30
export const MOTIVO_RECUSA = 'Recusado pelo profissional'
export const MENSAGEM_BLOQUEADO = 'Horário indisponível. O profissional bloqueou a agenda neste período.'
export const MENSAGEM_OCUPADO = 'Horário indisponível: o profissional já tem um pedido nesse período.'
const PASSO_SLOTS_MIN = 30
const MAX_TENTATIVAS_CODIGO = 5

const erro = (message: string, status = 400) => new HttpError(status, { status, message })
const naZona = (data: string, hora: string) => DateTime.fromISO(`${data}T${hora}`, { zone: FUSO_CONSULTA })
const diaSemana = (d: DateTime) => String(d.weekday % 7)
const hhmm = (d: DateTime) => d.toFormat('HH:mm')

/* ------------------------------- regras puras ------------------------------ */

type EntradaPeriodo = { data: string; horario: string; data_fim?: string | null; horario_fim?: string | null }

export function calcularPeriodo(modalidade: Modalidade, e: EntradaPeriodo, duracaoMin: number | null): Periodo {
  const inicio = naZona(e.data, e.horario)
  if (!inicio.isValid) throw erro('Data ou horário inválido')

  if (modalidade === 'duracao') {
    if (!duracaoMin) throw erro('Serviço sem duração definida')
    return { inicio, fim: inicio.plus({ minutes: duracaoMin }), dias: 1 }
  }

  if (!e.data_fim) throw erro('Informe a data de saída')
  const fim = naZona(e.data_fim, e.horario_fim || e.horario)
  if (!fim.isValid) throw erro('Data ou horário de saída inválido')
  if (fim <= inicio) throw erro('A saída deve ser depois da entrada')
  const dias = Math.max(1, Math.ceil(fim.diff(inicio, 'days').days - 1e-9))
  if (dias > MAX_DIAS_HOSPEDAGEM) throw erro(`A hospedagem pode ter no máximo ${MAX_DIAS_HOSPEDAGEM} diárias`)
  return { inicio, fim, dias }
}

/** Mensagem do motivo quando o período não cabe na grade semanal; null = cabe. */
export function foraDaGrade(grade: Grade, modalidade: Modalidade, p: Pick<Periodo, 'inicio' | 'fim'>): string | null {
  if (modalidade === 'duracao') {
    const faixa = grade[diaSemana(p.inicio)]
    if (!faixa) return 'O profissional não atende neste dia da semana'
    if (!p.fim.hasSame(p.inicio, 'day') || hhmm(p.inicio) < faixa[0] || hhmm(p.fim) > faixa[1]) {
      return `Fora do horário de atendimento (${faixa[0]} às ${faixa[1]})`
    }
    return null
  }

  for (const [momento, rotulo] of [
    [p.inicio, 'entrada'],
    [p.fim, 'saída'],
  ] as const) {
    const faixa = grade[diaSemana(momento)]
    if (!faixa) return `O profissional não atende no dia da ${rotulo}`
    if (hhmm(momento) < faixa[0] || hhmm(momento) > faixa[1]) {
      return `Horário de ${rotulo} fora do atendimento (${faixa[0]} às ${faixa[1]})`
    }
  }
  return null
}

export const sobrepoe = (a: { inicio: Date; fim: Date }, b: { inicio: Date; fim: Date }) =>
  a.inicio < b.fim && a.fim > b.inicio

type BloqueioLike = Pick<BloqueioAgenda, 'dataInicio' | 'dataFim' | 'horarios'> &
  Partial<Pick<BloqueioAgenda, 'recorrente' | 'diasSemana'>>

/** Bloqueio de dia inteiro ou de horários (cada horário bloqueia 1h) que toca o período. */
export function bloqueioAtinge(bloqueios: BloqueioLike[], p: Pick<Periodo, 'inicio' | 'fim'>) {
  for (let dia = p.inicio.startOf('day'); dia < p.fim; dia = dia.plus({ days: 1 })) {
    const data = dia.toISODate()!
    for (const b of bloqueios) {
      if (!bloqueioCobreData(b, data)) continue
      const horas = horariosDoBloqueio(b)
      if (horas === null) return true
      if (horas.some((h) => sobrepoe({ inicio: naZona(data, h).toJSDate(), fim: naZona(data, h).plus({ hours: 1 }).toJSDate() }, { inicio: p.inicio.toJSDate(), fim: p.fim.toJSDate() }))) {
        return true
      }
    }
  }
  return false
}

/* ---------------------------------- dados ---------------------------------- */

const includePedido = {
  tutor: { include: { user: true } },
  pet: true,
  prestador: { include: { user: true, tipoServico: true } },
  servicoOferecido: true,
} satisfies Prisma.AgendamentoInclude

const buscarPedido = (id: string) => prisma.agendamento.findUnique({ where: { id }, include: includePedido })

export type Pedido = NonNullable<Awaited<ReturnType<typeof buscarPedido>>>
/** User como sai do client global (sem senha nem tokens do Google). */
type Usuario = Omit<User, 'password' | 'googleAccessToken' | 'googleRefreshToken' | 'googleTokenExpiresAt'>

const carregarPrestadorAtivo = (id: string) =>
  prisma.prestador.findFirst({
    where: { id, onboardingComplete: 1, user: { ativo: 1 }, tipoServico: { ativo: 1 } },
    include: { user: true, tipoServico: true },
  })

type PrestadorAtivo = NonNullable<Awaited<ReturnType<typeof carregarPrestadorAtivo>>>

export function bloqueiosDoPrestador(prestadorId: string, de: string, ate: string = de) {
  return prisma.bloqueioAgenda.findMany({
    where: { prestadorId, dataInicio: { lte: ate }, OR: [{ dataFim: null }, { dataFim: { gte: de } }] },
    orderBy: [{ dataInicio: 'asc' }, { createdAt: 'asc' }],
  })
}

const ocupaWhere = (prestadorId: string, inicio: Date, fim: Date, ignorarId?: string): Prisma.AgendamentoWhereInput => ({
  prestadorId,
  status: { in: STATUS_OCUPAM },
  inicioEm: { lt: fim },
  fimEm: { gt: inicio },
  ...(ignorarId ? { id: { not: ignorarId } } : {}),
})

const gradeDe = (p: { horarios: unknown }) => (p.horarios as Grade | null) || {}

async function validarAgenda(
  prestador: PrestadorAtivo,
  modalidade: Modalidade,
  periodo: Periodo,
  ignorarId?: string
) {
  if (periodo.inicio < DateTime.now()) throw erro('Escolha um horário futuro')
  const fora = foraDaGrade(gradeDe(prestador), modalidade, periodo)
  if (fora) throw erro(fora)
  const bloqueios = await bloqueiosDoPrestador(prestador.id, periodo.inicio.toISODate()!, periodo.fim.toISODate()!)
  if (bloqueioAtinge(bloqueios, periodo)) throw erro(MENSAGEM_BLOQUEADO)
  const ocupado = await prisma.agendamento.findFirst({
    where: ocupaWhere(prestador.id, periodo.inicio.toJSDate(), periodo.fim.toJSDate(), ignorarId),
  })
  if (ocupado) throw erro(MENSAGEM_OCUPADO, 409)
}

const enderecoDe = (u: Pick<Usuario, 'rua' | 'numero' | 'bairro' | 'cidade' | 'estado'> | null | undefined) =>
  u ? [u.rua && `${u.rua}${u.numero ? `, ${u.numero}` : ''}`, u.bairro, u.cidade, u.estado].filter(Boolean).join(' - ') : ''

/* ---------------------------------- pedido --------------------------------- */

const isoDate = () => vine.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/)
const hora = () => vine.string().trim().regex(/^([01]\d|2[0-3]):[0-5]\d$/)

export const pedidoValidator = vine.compile(
  vine.object({
    pet_id: vine.string().trim(),
    servico_id: vine.string().trim(),
    data: isoDate(),
    horario: hora(),
    data_fim: isoDate().optional().nullable(),
    horario_fim: hora().optional().nullable(),
    local: vine.enum(['domicilio', 'local_proprio'] as const),
    observacoes: vine.string().trim().maxLength(255).optional().nullable(),
  })
)

export const remarcarValidator = vine.compile(
  vine.object({
    data: isoDate(),
    horario: hora(),
    data_fim: isoDate().optional().nullable(),
    horario_fim: hora().optional().nullable(),
  })
)

const camposDoPeriodo = (p: Periodo) => ({
  inicioEm: p.inicio.toUTC().toJSDate(),
  fimEm: p.fim.toUTC().toJSDate(),
  dataConsulta: p.inicio.toISODate()!,
  horarioConsulta: hhmm(p.inicio),
  // Lucid grava sem ms; com ms o MySQL arredondaria para o dia seguinte.
  startCodeExpiresAt: p.inicio.endOf('day').set({ millisecond: 0 }).toJSDate(),
})

const precoDo = (preco: unknown, modalidade: Modalidade, p: Periodo) =>
  Number((Number(preco) * (modalidade === 'periodo' ? p.dias : 1)).toFixed(2))

/** Tutor pede um serviço. O pedido nasce pendente até o prestador aceitar. */
export async function criarPedido(tutor: { id: string; user: Usuario }, prestadorId: string, body: unknown) {
  const d = await pedidoValidator.validate(body)
  const [prestador, pet] = await Promise.all([
    carregarPrestadorAtivo(prestadorId),
    prisma.pet.findFirst({ where: { id: d.pet_id, tutorId: tutor.id } }),
  ])
  if (!prestador) throw erro('Profissional não encontrado', 404)
  if (!pet) throw erro('Pet não encontrado', 404)

  const servico = await prisma.servicoOferecido.findFirst({ where: { id: d.servico_id, prestadorId, ativo: 1 } })
  if (!servico) throw erro('Serviço não encontrado', 404)
  if (d.local === 'domicilio' && !prestador.atendeDomicilio) throw erro('Este profissional não atende em domicílio')
  if (d.local === 'local_proprio' && !prestador.atendeLocalProprio) {
    throw erro('Este profissional não atende em local próprio')
  }

  const modalidade = prestador.tipoServico.modalidade as Modalidade
  const periodo = calcularPeriodo(modalidade, d, servico.duracaoMin)
  await validarAgenda(prestador, modalidade, periodo)

  const limite = await canCreateAppointment(prestador, 'prestador')
  if (!limite.allowed) throw erro('Este profissional atingiu o limite de pedidos do mês. Tente outro profissional.', 403)

  const pedido = await prisma.$transaction(async (tx) => {
    const ocupado = await tx.agendamento.findFirst({
      where: ocupaWhere(prestador.id, periodo.inicio.toJSDate(), periodo.fim.toJSDate()),
    })
    if (ocupado) throw erro(MENSAGEM_OCUPADO, 409)
    return tx.agendamento.create({
      data: creating({
        tutorId: tutor.id,
        petId: pet.id,
        prestadorId: prestador.id,
        servicoOferecidoId: servico.id,
        status: 'pendente',
        tipoConsulta: prestador.tipoServico.slug,
        precoConsulta: precoDo(servico.preco, modalidade, periodo),
        observacoes: d.observacoes || null,
        localNome: d.local === 'domicilio' ? 'Domicílio do tutor' : 'Local do profissional',
        localEndereco: enderecoDe(d.local === 'domicilio' ? tutor.user : prestador.user) || null,
        startCode: randomInt(100000, 999999).toString(),
        startCodeAttempts: 0,
        ...camposDoPeriodo(periodo),
      }),
      include: includePedido,
    })
  })

  await incrementUsage(prestador, 'prestador')
  after(() => avisarPedido('novo', pedido.id))
  return serializarPedido(pedido, 'tutor')
}

/** Horários livres de um dia para um serviço (início de cada slot, de 30 em 30 min). */
export async function disponibilidade(prestadorId: string, servicoId: string, data: string) {
  const prestador = await carregarPrestadorAtivo(prestadorId)
  if (!prestador) throw erro('Profissional não encontrado', 404)
  const servico = await prisma.servicoOferecido.findFirst({ where: { id: servicoId, prestadorId, ativo: 1 } })
  if (!servico) throw erro('Serviço não encontrado', 404)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) throw erro('Data inválida')

  const modalidade = prestador.tipoServico.modalidade as Modalidade
  const dia = naZona(data, '00:00')
  const faixa = gradeDe(prestador)[diaSemana(dia)] || null
  if (!faixa) return { data, modalidade, faixa: null, horarios: [] as string[] }

  const duracao = modalidade === 'duracao' ? servico.duracaoMin || PASSO_SLOTS_MIN : PASSO_SLOTS_MIN
  const abre = naZona(data, faixa[0])
  const fecha = naZona(data, faixa[1])
  const [bloqueios, ocupados] = await Promise.all([
    bloqueiosDoPrestador(prestador.id, data),
    prisma.agendamento.findMany({
      where: ocupaWhere(prestador.id, abre.toJSDate(), fecha.toJSDate()),
      select: { inicioEm: true, fimEm: true },
    }),
  ])

  const agora = DateTime.now()
  const horarios: string[] = []
  for (let s = abre; s.plus({ minutes: duracao }) <= fecha; s = s.plus({ minutes: PASSO_SLOTS_MIN })) {
    const slot = { inicio: s, fim: s.plus({ minutes: duracao }) }
    if (s <= agora || bloqueioAtinge(bloqueios, slot)) continue
    const janela = { inicio: slot.inicio.toJSDate(), fim: slot.fim.toJSDate() }
    if (ocupados.some((o) => o.inicioEm && o.fimEm && sobrepoe(janela, { inicio: o.inicioEm, fim: o.fimEm }))) continue
    horarios.push(hhmm(s))
  }
  return { data, modalidade, faixa, horarios }
}

/* ------------------------------ serialização ------------------------------- */

export function serializarPedido(a: Pedido, visao: 'tutor' | 'prestador') {
  const tutorUser = a.tutor?.user
  const profUser = a.prestador?.user
  const ativo = a.status === 'confirmado' || a.status === 'em andamento'
  return {
    id: a.id,
    status: a.status,
    inicio_em: a.inicioEm?.toISOString() ?? null,
    fim_em: a.fimEm?.toISOString() ?? null,
    data: a.dataConsulta,
    horario: a.horarioConsulta,
    preco: a.precoConsulta === null ? null : Number(a.precoConsulta),
    observacoes: a.observacoes,
    local_nome: a.localNome,
    local_endereco: a.localEndereco,
    motivo_cancelamento: a.motivoCancelamento,
    started_at: a.startedAt?.toISOString() ?? null,
    ended_at: a.endedAt?.toISOString() ?? null,
    servico: a.servicoOferecido
      ? { id: a.servicoOferecido.id, nome: a.servicoOferecido.nome, duracao_min: a.servicoOferecido.duracaoMin }
      : null,
    tipo_servico: a.prestador
      ? {
          slug: a.prestador.tipoServico.slug,
          nome: a.prestador.tipoServico.nome,
          modalidade: a.prestador.tipoServico.modalidade as Modalidade,
        }
      : null,
    pet: a.pet ? { id: a.pet.id, nome: a.pet.nome, especie: a.pet.especie, raca: a.pet.raca } : null,
    ...(visao === 'tutor'
      ? {
          start_code: a.status === 'confirmado' ? a.startCode : null,
          prestador: a.prestador
            ? {
                id: a.prestador.id,
                nome: profUser ? nomeCompleto(profUser) : 'Profissional',
                foto_url: a.prestador.fotoUrl || profUser?.profilePic || null,
                celular: ativo ? profUser?.celular ?? null : null,
              }
            : null,
        }
      : {
          tutor: tutorUser
            ? { nome: nomeCompleto(tutorUser), celular: ativo ? tutorUser.celular : null }
            : null,
        }),
  }
}

/* ------------------------------ lado prestador ----------------------------- */

export async function listarPedidosDoPrestador(prestadorId: string, status?: string) {
  const pedidos = await prisma.agendamento.findMany({
    where: { prestadorId, ...(status ? { status } : {}) },
    include: includePedido,
    orderBy: [{ inicioEm: 'asc' }],
  })
  return pedidos.map((p) => serializarPedido(p, 'prestador'))
}

async function pedidoDoPrestador(prestadorId: string, id: string) {
  const pedido = await prisma.agendamento.findFirst({ where: { id, prestadorId }, include: includePedido })
  if (!pedido) throw erro('Pedido não encontrado', 404)
  return pedido
}

async function atualizar(id: string, data: Prisma.AgendamentoUpdateInput) {
  return prisma.agendamento.update({ where: { id }, data: updating(data), include: includePedido })
}

export async function aceitarPedido(prestadorId: string, id: string) {
  const pedido = await pedidoDoPrestador(prestadorId, id)
  if (pedido.status !== 'pendente') throw erro('Só pedidos pendentes podem ser aceitos')
  if (pedido.inicioEm && pedido.inicioEm < new Date()) throw erro('O horário deste pedido já passou')
  const atualizado = await atualizar(id, { status: 'confirmado', confirmadoEm: prepareDateTimeString(DateTime.now()) })
  after(() => avisarPedido('aceito', id))
  return serializarPedido(atualizado, 'prestador')
}

/** Recusa um pendente ou cancela um confirmado (devolve a cota do mês). */
export async function recusarPedido(prestadorId: string, id: string, motivo?: string | null) {
  const pedido = await pedidoDoPrestador(prestadorId, id)
  if (!['pendente', 'confirmado'].includes(pedido.status)) throw erro('Este pedido não pode mais ser recusado')
  const motivoFinal = motivo?.trim() ? `${MOTIVO_RECUSA}: ${motivo.trim()}` : MOTIVO_RECUSA
  const atualizado = await atualizar(id, {
    status: 'cancelado',
    motivoCancelamento: motivoFinal.slice(0, 255),
    canceladoEm: prepareDateTimeString(DateTime.now()),
  })
  if (pedido.prestador) await decrementUsage(pedido.prestador, 'prestador')
  after(() => avisarPedido('recusado', id, motivoFinal))
  return serializarPedido(atualizado, 'prestador')
}

export async function iniciarPedido(prestadorId: string, id: string, code: unknown) {
  const pedido = await pedidoDoPrestador(prestadorId, id)
  if (!code || typeof code !== 'string') throw erro('Código é obrigatório')
  if (pedido.status !== 'confirmado') throw erro('Só pedidos aceitos podem ser iniciados')
  const tentativas = pedido.startCodeAttempts ?? 0
  if (tentativas >= MAX_TENTATIVAS_CODIGO) throw erro('Muitas tentativas inválidas. Tente novamente mais tarde.')
  if (!pedido.startCode || !pedido.startCodeExpiresAt) throw erro('Este pedido não possui código ativo')
  const agora = new Date()
  if (agora > pedido.startCodeExpiresAt) throw erro('Código expirado')
  if (code !== pedido.startCode) {
    await prisma.agendamento.update({ where: { id }, data: updating({ startCodeAttempts: tentativas + 1 }) })
    throw erro('Código inválido')
  }
  const atualizado = await atualizar(id, { status: 'em andamento', startCodeUsedAt: agora, startedAt: agora })
  return serializarPedido(atualizado, 'prestador')
}

export async function concluirPedido(prestadorId: string, id: string) {
  const pedido = await pedidoDoPrestador(prestadorId, id)
  if (pedido.status !== 'em andamento') throw erro('Inicie o serviço com o código do tutor antes de concluir')
  const atualizado = await atualizar(id, { status: 'realizado', endedAt: new Date() })
  after(() => avisarPedido('concluido', id))
  return serializarPedido(atualizado, 'prestador')
}

/* -------------------------------- lado tutor ------------------------------- */

export async function listarPedidosDoTutor(tutorId: string) {
  const pedidos = await prisma.agendamento.findMany({
    where: { tutorId, prestadorId: { not: null } },
    include: includePedido,
    orderBy: [{ inicioEm: 'desc' }],
  })
  return pedidos.map((p) => serializarPedido(p, 'tutor'))
}

/** Cancelar/remarcar de `/agendamentos/:id` delegam para cá quando o agendamento é pedido de prestador. */
export async function ehPedidoDePrestador(id: string, tutorId: string) {
  const a = await prisma.agendamento.findFirst({ where: { id, tutorId }, select: { prestadorId: true } })
  return Boolean(a?.prestadorId)
}

async function pedidoDoTutor(tutorId: string, id: string) {
  const pedido = await prisma.agendamento.findFirst({
    where: { id, tutorId, prestadorId: { not: null } },
    include: includePedido,
  })
  if (!pedido) throw erro('Agendamento não encontrado', 404)
  if (!podeSerCancelado(pedido.status)) throw erro('Este pedido não pode mais ser alterado')
  return pedido
}

export async function cancelarPedidoPeloTutor(tutorId: string, id: string, motivo?: string | null) {
  const pedido = await pedidoDoTutor(tutorId, id)
  await atualizar(id, {
    status: 'cancelado',
    motivoCancelamento: String(motivo || 'Cancelado pelo tutor').slice(0, 255),
    canceladoEm: prepareDateTimeString(DateTime.now()),
  })
  if (pedido.prestador) await decrementUsage(pedido.prestador, 'prestador')
  after(() => avisarPedido('cancelado', id, motivo || null))
}

/** Remarcar volta o pedido para pendente: o prestador precisa aceitar de novo. */
export async function remarcarPedido(tutorId: string, id: string, body: unknown) {
  const pedido = await pedidoDoTutor(tutorId, id)
  const d = await remarcarValidator.validate(body)
  const prestador = await carregarPrestadorAtivo(pedido.prestadorId!)
  if (!prestador) throw erro('Profissional não encontrado', 404)

  const modalidade = prestador.tipoServico.modalidade as Modalidade
  const duracao =
    pedido.servicoOferecido?.duracaoMin ??
    (pedido.inicioEm && pedido.fimEm ? Math.round((pedido.fimEm.getTime() - pedido.inicioEm.getTime()) / 60000) : null)
  const periodo = calcularPeriodo(modalidade, d, duracao)
  await validarAgenda(prestador, modalidade, periodo, id)

  const atualizado = await atualizar(id, {
    status: 'pendente',
    confirmadoEm: null,
    startCodeAttempts: 0,
    ...camposDoPeriodo(periodo),
    ...(pedido.servicoOferecido ? { precoConsulta: precoDo(pedido.servicoOferecido.preco, modalidade, periodo) } : {}),
  })
  after(() => avisarPedido('remarcado', id))
  return serializarPedido(atualizado, 'tutor')
}

/* -------------------------------- bloqueios -------------------------------- */

async function pedidosNoBloqueio(prestadorId: string, input: BloqueioInput) {
  const de = naZona(input.dataInicio, '00:00').toJSDate()
  const ate = input.dataFim ? naZona(input.dataFim, '00:00').plus({ days: 1 }).toJSDate() : null
  const pedidos = await prisma.agendamento.findMany({
    where: {
      prestadorId,
      status: { in: STATUS_OCUPAM },
      fimEm: { gt: de },
      ...(ate ? { inicioEm: { lt: ate } } : {}),
    },
    include: includePedido,
  })
  const bloqueio = { ...input, recorrente: input.recorrente ? 1 : 0 }
  return pedidos.filter(
    (p) =>
      p.inicioEm &&
      p.fimEm &&
      bloqueioAtinge([bloqueio], {
        inicio: DateTime.fromJSDate(p.inicioEm).setZone(FUSO_CONSULTA),
        fim: DateTime.fromJSDate(p.fimEm).setZone(FUSO_CONSULTA),
      })
  )
}

/** Bloqueio que pega pedido ativo é recusado (409): o prestador resolve o pedido antes. */
export async function criarBloqueioPrestador(prestadorId: string, userId: string, body: unknown) {
  const input = await validarBloqueio(body)
  const conflitos = await pedidosNoBloqueio(prestadorId, input)
  if (conflitos.length) {
    throw new HttpError(409, {
      status: 409,
      message: 'Há pedidos ativos neste período. Recuse ou peça para o tutor remarcar antes de bloquear.',
      conflitos: conflitos.map((p) => serializarPedido(p, 'prestador')),
    })
  }
  const bloqueio = await prisma.bloqueioAgenda.create({
    data: creating({
      prestadorId,
      dataInicio: input.dataInicio,
      dataFim: input.dataFim,
      recorrente: input.recorrente ? 1 : 0,
      diasSemana: input.diasSemana ?? undefined,
      horarios: input.horarios ?? undefined,
      motivo: input.motivo,
      criadoPorUserId: userId,
    }),
  })
  return serializeBloqueio(bloqueio)
}

export async function listarBloqueiosPrestador(prestadorId: string) {
  const bloqueios = await prisma.bloqueioAgenda.findMany({
    where: { prestadorId, OR: [{ dataFim: null }, { dataFim: { gte: DateTime.now().toISODate()! } }] },
    orderBy: [{ dataInicio: 'asc' }],
  })
  return bloqueios.map(serializeBloqueio)
}

export async function removerBloqueioPrestador(prestadorId: string, id: string) {
  const bloqueio = await prisma.bloqueioAgenda.findFirst({ where: { id, prestadorId } })
  if (!bloqueio) throw erro('Bloqueio não encontrado', 404)
  await prisma.bloqueioAgenda.delete({ where: { id } })
}

/* ---------------------------------- avisos --------------------------------- */

export type EventoPedido = 'novo' | 'aceito' | 'recusado' | 'cancelado' | 'remarcado' | 'concluido'

type Texto = { titulo: string; mensagem: string }
type Ctx = { tutor: string; prof: string; servico: string; pet: string; quando: string; codigo: string; motivo: string }

const AVISOS: Record<
  EventoPedido,
  {
    profissional?: (c: Ctx) => Texto
    tutor?: (c: Ctx) => Texto
    whatsapp?: [EventoWhatsapp, Destinatario[]]
    agenda?: AcaoAgenda
  }
> = {
  novo: {
    profissional: (c) => ({
      titulo: 'Novo pedido de serviço',
      mensagem: `${c.tutor} pediu "${c.servico}" para ${c.pet} (${c.quando}). Aceite ou recuse no seu painel.`,
    }),
    tutor: (c) => ({
      titulo: 'Pedido enviado',
      mensagem: `Seu pedido de "${c.servico}" foi enviado para ${c.prof}. Avisaremos quando for aceito.`,
    }),
    whatsapp: ['novo_agendamento', ['profissional']],
  },
  aceito: {
    tutor: (c) => ({
      titulo: 'Pedido aceito',
      mensagem: `${c.prof} aceitou "${c.servico}" para ${c.pet} (${c.quando}). Código de início: ${c.codigo}.`,
    }),
    whatsapp: ['confirmacao', ['tutor']],
    agenda: 'criar',
  },
  recusado: {
    tutor: (c) => ({
      titulo: 'Pedido não aceito',
      mensagem: `${c.prof} não poderá atender "${c.servico}" para ${c.pet} (${c.quando}). ${c.motivo}`.trim(),
    }),
    whatsapp: ['cancelamento', ['tutor']],
    agenda: 'cancelar',
  },
  cancelado: {
    profissional: (c) => ({
      titulo: 'Pedido cancelado',
      mensagem: `${c.tutor} cancelou "${c.servico}" de ${c.pet} (${c.quando}). ${c.motivo}`.trim(),
    }),
    tutor: (c) => ({ titulo: 'Pedido cancelado', mensagem: `Você cancelou "${c.servico}" com ${c.prof} (${c.quando}).` }),
    whatsapp: ['cancelamento', ['profissional']],
    agenda: 'cancelar',
  },
  remarcado: {
    profissional: (c) => ({
      titulo: 'Pedido remarcado',
      mensagem: `${c.tutor} remarcou "${c.servico}" de ${c.pet} para ${c.quando}. Aceite ou recuse novamente.`,
    }),
    whatsapp: ['remarcacao', ['profissional']],
    agenda: 'atualizar',
  },
  concluido: {
    tutor: (c) => ({
      titulo: 'Serviço concluído',
      mensagem: `${c.prof} concluiu "${c.servico}" de ${c.pet}. Conte como foi avaliando o profissional.`,
    }),
  },
}

export function descreverPeriodo(a: Pick<Pedido, 'inicioEm' | 'fimEm'>) {
  if (!a.inicioEm) return ''
  const inicio = DateTime.fromJSDate(a.inicioEm).setZone(FUSO_CONSULTA)
  const fim = a.fimEm ? DateTime.fromJSDate(a.fimEm).setZone(FUSO_CONSULTA) : inicio
  return inicio.hasSame(fim, 'day')
    ? `${inicio.toFormat('dd/MM/yyyy')} das ${hhmm(inicio)} às ${hhmm(fim)}`
    : `${inicio.toFormat('dd/MM/yyyy HH:mm')} até ${fim.toFormat('dd/MM/yyyy HH:mm')}`
}

async function avisarUsuario(user: Usuario, evento: EventoPedido, texto: Texto, a: Pedido, detalhes: [string, string | null][]) {
  try {
    await inAppNotifications.createGenericNotification({
      userId: user.id,
      type: `PEDIDO_${evento.toUpperCase()}`,
      title: texto.titulo,
      message: texto.mensagem,
      actionData: { agendamentoId: a.id, pedido: true },
    })
    if (podeEnviarEmail(user)) {
      await notifications.sendPedidoServico(user.email, texto.titulo, {
        titulo: texto.titulo,
        saudacao: `Olá, ${user.nome}!`,
        paragrafos: [texto.mensagem],
        detalhes,
      })
    }
  } catch (error) {
    console.error(`❌ [Pedido] Erro ao avisar ${evento} (User ID: ${user.id}):`, error)
  }
}

/** In-app, e-mail, WhatsApp e Google Agenda do pedido. Nunca lança. */
export async function avisarPedido(evento: EventoPedido, id: string, motivo?: string | null) {
  try {
    const a = await prisma.agendamento.findUnique({ where: { id }, include: includePedido })
    if (!a?.prestador) return
    const regra = AVISOS[evento]
    const profUser = a.prestador.user
    const tutorUser = a.tutor?.user ?? null
    const ctx: Ctx = {
      tutor: tutorUser ? nomeCompleto(tutorUser) : 'Tutor',
      prof: nomeCompleto(profUser),
      servico: a.servicoOferecido?.nome || a.prestador.tipoServico.nome,
      pet: a.pet?.nome || 'seu pet',
      quando: descreverPeriodo(a),
      codigo: a.startCode || '',
      motivo: motivo ? `Motivo: ${motivo}` : '',
    }
    const detalhes: [string, string | null][] = [
      ['Serviço', ctx.servico],
      ['Pet', a.pet?.nome ?? null],
      ['Quando', ctx.quando],
      ['Local', [a.localNome, a.localEndereco].filter(Boolean).join(' - ') || null],
      ['Valor', a.precoConsulta === null ? null : `R$ ${Number(a.precoConsulta).toFixed(2)}`],
    ]

    if (regra.profissional) await avisarUsuario(profUser, evento, regra.profissional(ctx), a, detalhes)
    if (regra.tutor && tutorUser) await avisarUsuario(tutorUser, evento, regra.tutor(ctx), a, detalhes)
    if (regra.whatsapp) await notificarAgendamento(regra.whatsapp[0], a.id, regra.whatsapp[1], { motivo: motivo || null })
    if (regra.agenda) await googleCalendar.sincronizarEvento(a.id, regra.agenda)
  } catch (error) {
    console.error(`❌ [Pedido] Erro geral ao avisar ${evento}:`, error)
  }
}
