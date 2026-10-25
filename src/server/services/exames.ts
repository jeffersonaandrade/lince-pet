import 'server-only'
import { after } from 'next/server'
import { DateTime } from 'luxon'
import vine from '@vinejs/vine'
import type { Prisma } from '@/generated/prisma/client'
import { prisma } from '../db'
import { HttpError } from '../http'
import { creating, updating, uuid } from '../lucid'
import { FUSO_CONSULTA, podeSerCancelado, prepareDateTimeString } from './agendamentos'
import { LIMITE_EXAMES_MES, planoComExames, podeAgendarExame } from './assinatura-regras'
import { bloqueioAtinge, STATUS_OCUPAM } from './pedidos-prestador'
import { conferirEncaminhamento, vincularAgendamento } from './encaminhamentos'
import { serializarRt } from './aprovacoes'
import {
  blocosAbertos,
  cabeNoExpediente,
  clinicaVisivelNosExames,
  exameLotado,
  inicioDoBloco,
  motivoComboInvalido,
  paraHHmm,
  PASSO_EXAME_MIN,
  totaisDoPedido,
  type Ocupacao,
} from './exames-regras'
import { avisarExame } from './exames-avisos'
import { MOTIVO_PADRAO_TUTOR } from '@/lib/motivos-cancelamento'
import { conferirPetAtivo } from './pets'

/**
 * Clínica de exames: catálogo (exames e combos), agenda por horário com capacidade por exame,
 * agendamento direto do tutor (ou por encaminhamento) já confirmado e pagamento na clínica.
 * O agendamento reaproveita `agendamentos` com `tipoConsulta = 'exame'`, `clinicaId` e sem vet;
 * os exames escolhidos ficam copiados em `agendamento_exames` (nome, preparo, preço, duração).
 */

export const TIPO_EXAME = 'exame'
export const MENSAGEM_LOTADO = 'Horário indisponível: não há mais vaga para este exame neste horário.'
const MAX_DURACAO_MIN = 8 * 60
const MAX_CAPACIDADE = 50

const erro = (message: string, status = 400) => new HttpError(status, { status, message })
const naZona = (data: string, hora: string) => DateTime.fromISO(`${data}T${hora}`, { zone: FUSO_CONSULTA })
const PLANOS_COM_EXAMES = Object.keys(LIMITE_EXAMES_MES)

/* --------------------------------- catálogo -------------------------------- */

const textoOpcional = (max: number) => vine.string().trim().maxLength(max).optional().nullable()

export const exameValidator = vine.compile(
  vine.object({
    nome: vine.string().trim().minLength(2).maxLength(150),
    descricao: textoOpcional(500),
    preparo: textoOpcional(500),
    preco: vine.number().positive().max(99999999),
    duracao_min: vine.number().withoutDecimals().range([5, MAX_DURACAO_MIN]),
    capacidade: vine.number().withoutDecimals().range([1, MAX_CAPACIDADE]).optional(),
    ativo: vine.boolean().optional(),
  })
)

export const comboValidator = vine.compile(
  vine.object({
    nome: vine.string().trim().minLength(2).maxLength(150),
    descricao: textoOpcional(500),
    preco: vine.number().positive().max(99999999),
    exame_ids: vine.array(vine.string().trim()).minLength(2).maxLength(30),
    ativo: vine.boolean().optional(),
  })
)

const includeCombo = { itens: { include: { exame: true } } } satisfies Prisma.ComboExameInclude
type ExameRow = Prisma.ExameOferecidoGetPayload<object>
type ComboRow = Prisma.ComboExameGetPayload<{ include: typeof includeCombo }>

export const serializarExame = (e: ExameRow) => ({
  id: e.id,
  nome: e.nome,
  descricao: e.descricao,
  preparo: e.preparo,
  preco: Number(e.preco),
  duracao_min: e.duracaoMin,
  capacidade: e.capacidade,
  ativo: e.ativo === 1,
})

/** Combo vendável: ativo e com todos os exames ativos. */
const comboDisponivel = (c: ComboRow) => c.ativo === 1 && c.itens.length >= 2 && c.itens.every((i) => i.exame.ativo === 1)

export const serializarCombo = (c: ComboRow) => {
  const exames = c.itens.map((i) => i.exame)
  return {
    id: c.id,
    nome: c.nome,
    descricao: c.descricao,
    preco: Number(c.preco),
    preco_avulso: totaisDoPedido(exames).preco,
    duracao_min: totaisDoPedido(exames).duracaoMin,
    ativo: c.ativo === 1,
    disponivel: comboDisponivel(c),
    exames: exames.map((e) => ({ id: e.id, nome: e.nome, preparo: e.preparo })),
  }
}

function inicioDoMes() {
  return DateTime.now().setZone(FUSO_CONSULTA).startOf('month').toUTC().toJSDate()
}

export function examesAgendadosNoMes(clinicaId: string, db: Prisma.TransactionClient | typeof prisma = prisma) {
  return db.agendamento.count({
    where: { clinicaId, tipoConsulta: TIPO_EXAME, createdAt: { gte: inicioDoMes() }, status: { notIn: ['cancelado', 'cancelada'] } },
  })
}

async function clinicaDoPainel(clinicaId: string) {
  const clinica = await prisma.clinica.findUnique({ where: { id: clinicaId } })
  if (!clinica) throw erro('Clínica não encontrada', 404)
  return clinica
}

/** Painel da clínica: módulo, plano, RT, catálogo e uso do mês. */
export async function catalogoDaClinica(clinicaId: string) {
  const clinica = await clinicaDoPainel(clinicaId)
  const [exames, combos, usados] = await Promise.all([
    prisma.exameOferecido.findMany({ where: { clinicaId }, orderBy: { nome: 'asc' } }),
    prisma.comboExame.findMany({ where: { clinicaId }, include: includeCombo, orderBy: { nome: 'asc' } }),
    examesAgendadosNoMes(clinicaId),
  ])
  const temPlano = planoComExames(clinica.subscriptionPlanCode)
  return {
    exames_ativo: clinica.examesAtivo === 1,
    plano_com_exames: temPlano,
    visivel: clinicaVisivelNosExames(clinica, temPlano),
    uso_mes: { usados, limite: temPlano ? LIMITE_EXAMES_MES[clinica.subscriptionPlanCode!] : 0 },
    rt: serializarRt(clinica),
    exames: exames.map(serializarExame),
    combos: combos.map(serializarCombo),
  }
}

/** Ligar o módulo exige plano com exames; desligar é sempre possível (os agendamentos feitos ficam). */
export async function alternarModulo(clinicaId: string, ativo: unknown) {
  const clinica = await clinicaDoPainel(clinicaId)
  const ligar = ativo === true || ativo === 'true' || ativo === 1
  if (ligar && !planoComExames(clinica.subscriptionPlanCode)) {
    throw erro('Assine um plano de clínica para oferecer exames na Lince Pet.', 403)
  }
  await prisma.clinica.update({ where: { id: clinicaId }, data: updating({ examesAtivo: ligar ? 1 : 0 }) })
  return catalogoDaClinica(clinicaId)
}

const dadosDoExame = (d: Awaited<ReturnType<typeof exameValidator.validate>>) => ({
  nome: d.nome,
  descricao: d.descricao || null,
  preparo: d.preparo || null,
  preco: d.preco,
  duracaoMin: d.duracao_min,
  capacidade: d.capacidade ?? 1,
  ...(d.ativo === undefined ? {} : { ativo: d.ativo ? 1 : 0 }),
})

async function exameDaClinica(clinicaId: string, id: string) {
  const exame = await prisma.exameOferecido.findFirst({ where: { id, clinicaId } })
  if (!exame) throw erro('Exame não encontrado', 404)
  return exame
}

export async function criarExame(clinicaId: string, body: unknown) {
  await clinicaDoPainel(clinicaId)
  const d = await exameValidator.validate(body)
  const exame = await prisma.exameOferecido.create({ data: creating({ clinicaId, ativo: 1, ...dadosDoExame(d) }) })
  return serializarExame(exame)
}

export async function atualizarExame(clinicaId: string, id: string, body: unknown) {
  await exameDaClinica(clinicaId, id)
  const d = await exameValidator.validate(body)
  const exame = await prisma.exameOferecido.update({ where: { id }, data: updating(dadosDoExame(d)) })
  return serializarExame(exame)
}

/** Exame com agendamento futuro só pode ser desativado (o agendamento guarda a cópia do nome e do preparo). */
export async function removerExame(clinicaId: string, id: string) {
  await exameDaClinica(clinicaId, id)
  const futuros = await prisma.agendamentoExame.count({
    where: { exameId: id, agendamento: { status: { in: STATUS_OCUPAM }, inicioEm: { gt: new Date() } } },
  })
  if (futuros > 0) {
    await prisma.exameOferecido.update({ where: { id }, data: updating({ ativo: 0 }) })
    return { removido: false, desativado: true }
  }
  await prisma.exameOferecido.delete({ where: { id } })
  return { removido: true, desativado: false }
}

async function validarItensDoCombo(clinicaId: string, exameIds: string[]) {
  const exames = await prisma.exameOferecido.findMany({ where: { id: { in: exameIds } } })
  const motivo = motivoComboInvalido(clinicaId, exameIds, exames)
  if (motivo) throw erro(motivo, 422)
  return [...new Set(exameIds)]
}

async function comboDaClinica(clinicaId: string, id: string) {
  const combo = await prisma.comboExame.findFirst({ where: { id, clinicaId } })
  if (!combo) throw erro('Combo não encontrado', 404)
  return combo
}

export async function criarCombo(clinicaId: string, body: unknown) {
  await clinicaDoPainel(clinicaId)
  const d = await comboValidator.validate(body)
  const ids = await validarItensDoCombo(clinicaId, d.exame_ids)
  const combo = await prisma.comboExame.create({
    data: {
      ...creating({ clinicaId, nome: d.nome, descricao: d.descricao || null, preco: d.preco, ativo: d.ativo === false ? 0 : 1 }),
      itens: { create: ids.map((exameId) => ({ exameId })) },
    },
    include: includeCombo,
  })
  return serializarCombo(combo)
}

export async function atualizarCombo(clinicaId: string, id: string, body: unknown) {
  await comboDaClinica(clinicaId, id)
  const d = await comboValidator.validate(body)
  const ids = await validarItensDoCombo(clinicaId, d.exame_ids)
  const combo = await prisma.$transaction(async (tx) => {
    await tx.comboExameItem.deleteMany({ where: { comboId: id } })
    return tx.comboExame.update({
      where: { id },
      data: {
        ...updating({ nome: d.nome, descricao: d.descricao || null, preco: d.preco }),
        ...(d.ativo === undefined ? {} : { ativo: d.ativo ? 1 : 0 }),
        itens: { create: ids.map((exameId) => ({ exameId })) },
      },
      include: includeCombo,
    })
  })
  return serializarCombo(combo)
}

export async function removerCombo(clinicaId: string, id: string) {
  await comboDaClinica(clinicaId, id)
  await prisma.comboExame.delete({ where: { id } })
  return { removido: true }
}

/* ---------------------------------- público -------------------------------- */

const ondeClinicaVisivel: Prisma.ClinicaWhereInput = {
  examesAtivo: 1,
  rtStatus: 'aprovado',
  subscriptionPlanCode: { in: PLANOS_COM_EXAMES },
  user: { ativo: 1 },
}

const includePublico = {
  examesOferecidos: { where: { ativo: 1 }, orderBy: { nome: 'asc' as const } },
  combosExame: { where: { ativo: 1 }, include: includeCombo, orderBy: { nome: 'asc' as const } },
} satisfies Prisma.ClinicaInclude

type ClinicaPublica = Prisma.ClinicaGetPayload<{ include: typeof includePublico }>

const serializarClinicaComExames = (c: ClinicaPublica) => ({
  clinica: {
    id: c.id,
    nome: c.nomeClinica,
    endereco: c.endereco,
    cidade: c.cidade,
    estado: c.estado,
    foto: c.fotoPerfil,
    telefone: c.telefone,
  },
  exames: c.examesOferecidos.map(serializarExame),
  combos: c.combosExame.filter(comboDisponivel).map(serializarCombo),
})

/** Busca da aba Exames do explorar: clínicas visíveis com algum exame ativo (filtro por nome do exame e cidade). */
export async function buscarExames(filtros: { search?: string | null; cidade?: string | null }) {
  const like = (valor: string) => ({ contains: valor, mode: 'insensitive' as const })
  const clinicas = await prisma.clinica.findMany({
    where: {
      ...ondeClinicaVisivel,
      ...(filtros.cidade ? { cidade: like(filtros.cidade) } : {}),
      examesOferecidos: { some: { ativo: 1, ...(filtros.search ? { nome: like(filtros.search) } : {}) } },
    },
    include: includePublico,
    orderBy: { nomeClinica: 'asc' },
    take: 50,
  })
  return clinicas.map(serializarClinicaComExames)
}

async function clinicaVisivel(clinicaId: string) {
  const clinica = await prisma.clinica.findFirst({ where: { id: clinicaId, ...ondeClinicaVisivel }, include: includePublico })
  if (!clinica) throw erro('Esta clínica não está oferecendo exames no momento.', 404)
  return clinica
}

/** Seção "Exames" do perfil público; null quando a clínica não oferece exames visíveis. */
export async function examesDaClinicaPublica(clinicaId: string) {
  const clinica = await prisma.clinica.findFirst({ where: { id: clinicaId, ...ondeClinicaVisivel }, include: includePublico })
  return clinica && clinica.examesOferecidos.length ? serializarClinicaComExames(clinica) : null
}

/* ------------------------------- agendamento ------------------------------- */

const isoDate = () => vine.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/)
const hora = () => vine.string().trim().regex(/^([01]\d|2[0-3]):[0-5]\d$/)

export const agendarExameValidator = vine.compile(
  vine.object({
    pet_id: vine.string().trim(),
    exame_ids: vine.array(vine.string().trim()).maxLength(30).optional(),
    combo_id: vine.string().trim().optional().nullable(),
    data: isoDate(),
    horario: hora(),
    observacoes: vine.string().trim().maxLength(255).optional().nullable(),
    encaminhamento_id: vine.string().trim().optional().nullable(),
  })
)

export const remarcarExameValidator = vine.compile(vine.object({ data: isoDate(), horario: hora() }))

type Escolha = { exame_ids?: string[] | null; combo_id?: string | null }

/** Resolve a escolha (combo ou exames avulsos) em itens, duração e preço. */
export function escolhaDoPedido(clinica: ClinicaPublica, escolha: Escolha) {
  if (escolha.combo_id) {
    const combo = clinica.combosExame.find((c) => c.id === escolha.combo_id)
    if (!combo || !comboDisponivel(combo)) throw erro('Combo indisponível', 404)
    const exames = combo.itens.map((i) => i.exame)
    return { exames, combo, ...totaisDoPedido(exames, combo.preco) }
  }
  const ids = [...new Set(escolha.exame_ids ?? [])]
  if (!ids.length) throw erro('Escolha pelo menos um exame')
  const porId = new Map(clinica.examesOferecidos.map((e) => [e.id, e]))
  const exames = ids.map((id) => porId.get(id))
  if (exames.some((e) => !e)) throw erro('Exame indisponível', 404)
  const lista = exames as ExameRow[]
  return { exames: lista, combo: null, ...totaisDoPedido(lista) }
}

const ocupacoesWhere = (clinicaId: string, inicio: Date, fim: Date, ignorarId?: string): Prisma.AgendamentoWhereInput => ({
  clinicaId,
  tipoConsulta: TIPO_EXAME,
  status: { in: STATUS_OCUPAM },
  inicioEm: { lt: fim },
  fimEm: { gt: inicio },
  ...(ignorarId ? { id: { not: ignorarId } } : {}),
})

async function ocupacoes(db: Prisma.TransactionClient | typeof prisma, clinicaId: string, inicio: Date, fim: Date, ignorarId?: string) {
  const lista = await db.agendamento.findMany({
    where: ocupacoesWhere(clinicaId, inicio, fim, ignorarId),
    select: { inicioEm: true, fimEm: true, exames: { select: { exameId: true } } },
  })
  return lista.flatMap((a): Ocupacao[] =>
    a.inicioEm && a.fimEm
      ? [{ inicio: a.inicioEm, fim: a.fimEm, exameIds: a.exames.flatMap((e) => (e.exameId ? [e.exameId] : [])) }]
      : []
  )
}

/** Bloqueios da agenda da clínica inteira (sem vet nem prestador). */
const bloqueiosDaClinica = (clinicaId: string, de: string, ate: string = de) =>
  prisma.bloqueioAgenda.findMany({
    where: {
      clinicaId,
      veterinarioId: null,
      prestadorId: null,
      dataInicio: { lte: ate },
      OR: [{ dataFim: null }, { dataFim: { gte: de } }],
    },
  })

function periodoDoPedido(data: string, horario: string, duracaoMin: number) {
  const inicio = naZona(data, horario)
  if (!inicio.isValid) throw erro('Data ou horário inválido')
  return { inicio, fim: inicio.plus({ minutes: duracaoMin }) }
}

type Periodo = ReturnType<typeof periodoDoPedido>

async function validarHorario(clinica: ClinicaPublica, exames: ExameRow[], periodo: Periodo, duracaoMin: number, ignorarId?: string) {
  if (periodo.inicio <= DateTime.now()) throw erro('Escolha um horário futuro')
  const abertos = blocosAbertos(clinica.horariosFuncionamento, periodo.inicio.weekday)
  if (!cabeNoExpediente(abertos, inicioDoBloco(periodo.inicio.toFormat('HH:mm'))!, duracaoMin)) {
    throw erro('Fora do horário de funcionamento da clínica')
  }
  const bloqueios = await bloqueiosDaClinica(clinica.id, periodo.inicio.toISODate()!)
  if (bloqueioAtinge(bloqueios, periodo)) throw erro('Horário indisponível. A clínica bloqueou a agenda neste período.')
  const lotado = exameLotado(exames, await ocupacoes(prisma, clinica.id, periodo.inicio.toJSDate(), periodo.fim.toJSDate(), ignorarId), {
    inicio: periodo.inicio.toJSDate(),
    fim: periodo.fim.toJSDate(),
  })
  if (lotado) throw erro(MENSAGEM_LOTADO, 409)
}

/** Recheca a vaga dentro da transação, com trava por clínica (dois tutores no mesmo último lugar). */
async function garantirVaga(tx: Prisma.TransactionClient, clinicaId: string, exames: ExameRow[], periodo: Periodo, ignorarId?: string) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${clinicaId}))`
  const janela = { inicio: periodo.inicio.toJSDate(), fim: periodo.fim.toJSDate() }
  if (exameLotado(exames, await ocupacoes(tx, clinicaId, janela.inicio, janela.fim, ignorarId), janela)) {
    throw erro(MENSAGEM_LOTADO, 409)
  }
}

const camposDoPeriodo = (p: Periodo) => ({
  inicioEm: p.inicio.toUTC().toJSDate(),
  fimEm: p.fim.toUTC().toJSDate(),
  dataConsulta: p.inicio.toISODate()!,
  horarioConsulta: p.inicio.toFormat('HH:mm'),
})

/** Inícios livres no dia (de 30 em 30 min) para um conjunto de exames. */
async function horariosLivres(clinica: ClinicaPublica, exames: ExameRow[], duracaoMin: number, data: string, ignorarId?: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) throw erro('Data inválida')
  const dia = naZona(data, '00:00')
  if (!dia.isValid) throw erro('Data inválida')
  const abertos = blocosAbertos(clinica.horariosFuncionamento, dia.weekday)
  if (!abertos.size) return []

  const blocos = [...abertos].sort((a, b) => a - b)
  const abre = dia.plus({ minutes: blocos[0] })
  const fecha = dia.plus({ minutes: blocos[blocos.length - 1] + PASSO_EXAME_MIN })
  const [bloqueios, ocupadas] = await Promise.all([
    bloqueiosDaClinica(clinica.id, data),
    ocupacoes(prisma, clinica.id, abre.toJSDate(), fecha.toJSDate(), ignorarId),
  ])
  const agora = DateTime.now()
  return blocos.flatMap((m) => {
    const inicio = dia.plus({ minutes: m })
    const periodo = { inicio, fim: inicio.plus({ minutes: duracaoMin }) }
    if (inicio <= agora || !cabeNoExpediente(abertos, m, duracaoMin) || bloqueioAtinge(bloqueios, periodo)) return []
    const janela = { inicio: periodo.inicio.toJSDate(), fim: periodo.fim.toJSDate() }
    return exameLotado(exames, ocupadas, janela) ? [] : [paraHHmm(m)]
  })
}

/** Horários livres de um dia para a escolha (combo ou exames). */
export async function disponibilidadeExames(clinicaId: string, escolha: Escolha, data: string) {
  const clinica = await clinicaVisivel(clinicaId)
  const { exames, duracaoMin, preco } = escolhaDoPedido(clinica, escolha)
  return { data, duracao_min: duracaoMin, preco, horarios: await horariosLivres(clinica, exames, duracaoMin, data) }
}

const includeAgendamento = {
  tutor: { include: { user: true } },
  pet: true,
  clinica: { include: { user: true } },
  exames: true,
  laudo: true,
} satisfies Prisma.AgendamentoInclude

export const carregarAgendamentoExame = (id: string) =>
  prisma.agendamento.findFirst({ where: { id, tipoConsulta: TIPO_EXAME }, include: includeAgendamento })

export type AgendamentoExameCompleto = NonNullable<Awaited<ReturnType<typeof carregarAgendamentoExame>>>

export function serializarAgendamentoExame(a: AgendamentoExameCompleto) {
  const tutorUser = a.tutor?.user
  return {
    id: a.id,
    status: a.status,
    data: a.dataConsulta,
    horario: a.horarioConsulta,
    inicio_em: a.inicioEm?.toISOString() ?? null,
    fim_em: a.fimEm?.toISOString() ?? null,
    preco: Number(a.precoConsulta ?? 0),
    observacoes: a.observacoes,
    motivo_cancelamento: a.motivoCancelamento,
    clinica: a.clinica ? { id: a.clinica.id, nome: a.clinica.nomeClinica, endereco: a.clinica.endereco } : null,
    pet: a.pet ? { id: a.pet.id, nome: a.pet.nome, especie: a.pet.especie, raca: a.pet.raca } : null,
    tutor: tutorUser ? { nome: `${tutorUser.nome} ${tutorUser.sobrenome ?? ''}`.trim(), celular: tutorUser.celular, email: tutorUser.email } : null,
    exames: a.exames.map((e) => ({ nome: e.nome, preparo: e.preparo, combo: Boolean(e.comboId) })),
    laudo: a.laudo ? { nome_arquivo: a.laudo.nomeArquivo, enviado_em: a.laudo.enviadoEm?.toISOString() ?? null } : null,
  }
}

/** Tutor agenda exames: já nasce confirmado, pagamento na clínica. */
export async function agendarExame(tutor: { id: string }, clinicaId: string, body: unknown) {
  const d = await agendarExameValidator.validate(body)
  const [clinica, pet] = await Promise.all([
    clinicaVisivel(clinicaId),
    prisma.pet.findFirst({ where: { id: d.pet_id, tutorId: tutor.id, arquivadoEm: null } }),
  ])
  if (!pet) throw erro('Pet não encontrado', 404)
  const { exames, combo, duracaoMin, preco } = escolhaDoPedido(clinica, d)
  const periodo = periodoDoPedido(d.data, d.horario, duracaoMin)
  await validarHorario(clinica, exames, periodo, duracaoMin)

  const limite = podeAgendarExame(clinica.subscriptionPlanCode, await examesAgendadosNoMes(clinica.id))
  if (!limite.ok) throw erro(limite.motivo, 403)
  if (d.encaminhamento_id) {
    await conferirEncaminhamento(d.encaminhamento_id, { tutorId: tutor.id, petId: pet.id, clinicaId: clinica.id })
  }

  const agendamento = await prisma.$transaction(async (tx) => {
    await conferirPetAtivo(tx, pet.id)
    await garantirVaga(tx, clinica.id, exames, periodo)
    const planoAtual = await tx.clinica.findUnique({ where: { id: clinica.id } })
    const limiteAtual = podeAgendarExame(planoAtual?.subscriptionPlanCode, await examesAgendadosNoMes(clinica.id, tx))
    if (!limiteAtual.ok) throw erro(limiteAtual.motivo, 403)
    return tx.agendamento.create({
      data: {
        ...creating({
          tutorId: tutor.id,
          petId: pet.id,
          clinicaId: clinica.id,
          status: 'confirmado',
          tipoConsulta: TIPO_EXAME,
          precoConsulta: preco,
          observacoes: d.observacoes || null,
          localNome: clinica.nomeClinica,
          localEndereco: clinica.endereco,
          confirmadoEm: prepareDateTimeString(DateTime.now()),
          ...camposDoPeriodo(periodo),
        }),
        exames: {
          create: exames.map((e) => ({
            id: uuid(),
            exameId: e.id,
            comboId: combo?.id ?? null,
            nome: e.nome,
            preparo: e.preparo,
            preco: combo ? 0 : e.preco,
            duracaoMin: e.duracaoMin,
          })),
        },
      },
      include: includeAgendamento,
    })
  })

  if (d.encaminhamento_id) await vincularAgendamento(d.encaminhamento_id, agendamento.id)
  after(() => avisarExame('novo', agendamento.id))
  return serializarAgendamentoExame(agendamento)
}

/* ------------------------------ ações do tutor ----------------------------- */

export async function ehAgendamentoDeExame(id: string, tutorId: string) {
  const total = await prisma.agendamento.count({ where: { id, tutorId, tipoConsulta: TIPO_EXAME } })
  return total > 0
}

async function exameDoTutor(tutorId: string, id: string) {
  const a = await prisma.agendamento.findFirst({ where: { id, tutorId, tipoConsulta: TIPO_EXAME } })
  if (!a) throw erro('Agendamento não encontrado', 404)
  return a
}

export async function cancelarExamePeloTutor(tutorId: string, id: string, motivo?: string | null) {
  const a = await exameDoTutor(tutorId, id)
  if (!podeSerCancelado(a.status)) throw erro('Este agendamento não pode ser cancelado')
  await prisma.agendamento.update({
    where: { id },
    data: updating({
      status: 'cancelado',
      motivoCancelamento: motivo || MOTIVO_PADRAO_TUTOR,
      canceladoEm: prepareDateTimeString(DateTime.now()),
    }),
  })
  after(() => avisarExame('cancelado_tutor', id, motivo))
}

/** Para remarcar: a clínica e os exames do agendamento (a duração é a gravada no agendamento). */
async function exameRemarcavel(tutorId: string, id: string) {
  const a = await exameDoTutor(tutorId, id)
  if (!podeSerCancelado(a.status)) throw erro('Este agendamento não pode ser remarcado')
  const [clinica, itens] = await Promise.all([
    clinicaVisivel(a.clinicaId!),
    prisma.agendamentoExame.findMany({ where: { agendamentoId: id }, include: { exame: true } }),
  ])
  const exames = itens.flatMap((i) => (i.exame ? [i.exame] : []))
  if (exames.length !== itens.length) throw erro('Um dos exames não é mais oferecido. Cancele e agende de novo.')
  return { clinica, exames, petId: a.petId, duracaoMin: itens.reduce((s, i) => s + i.duracaoMin, 0) }
}

export async function disponibilidadeParaRemarcar(tutorId: string, id: string, data: string) {
  const { clinica, exames, duracaoMin } = await exameRemarcavel(tutorId, id)
  return { data, duracao_min: duracaoMin, horarios: await horariosLivres(clinica, exames, duracaoMin, data, id) }
}

export async function remarcarExame(tutorId: string, id: string, body: unknown) {
  const d = await remarcarExameValidator.validate(body)
  const { clinica, exames, duracaoMin, petId } = await exameRemarcavel(tutorId, id)
  const periodo = periodoDoPedido(d.data, d.horario, duracaoMin)
  await validarHorario(clinica, exames, periodo, duracaoMin, id)
  const atualizado = await prisma.$transaction(async (tx) => {
    if (petId) await conferirPetAtivo(tx, petId)
    await garantirVaga(tx, clinica.id, exames, periodo, id)
    return tx.agendamento.update({ where: { id }, data: updating(camposDoPeriodo(periodo)), include: includeAgendamento })
  })
  after(() => avisarExame('remarcado', id))
  return serializarAgendamentoExame(atualizado)
}

/* ------------------------------ agenda da clínica -------------------------- */

export async function agendaDeExames(clinicaId: string, filtros: { de?: string | null; ate?: string | null; status?: string | null }) {
  const de = filtros.de && /^\d{4}-\d{2}-\d{2}$/.test(filtros.de) ? naZona(filtros.de, '00:00') : DateTime.now().setZone(FUSO_CONSULTA).startOf('day')
  const ate = filtros.ate && /^\d{4}-\d{2}-\d{2}$/.test(filtros.ate) ? naZona(filtros.ate, '00:00').endOf('day') : de.plus({ days: 30 })
  const lista = await prisma.agendamento.findMany({
    where: {
      clinicaId,
      tipoConsulta: TIPO_EXAME,
      inicioEm: { gte: de.toJSDate(), lte: ate.toJSDate() },
      ...(filtros.status ? { status: filtros.status } : {}),
    },
    include: includeAgendamento,
    orderBy: { inicioEm: 'asc' },
    take: 300,
  })
  return lista.map(serializarAgendamentoExame)
}

async function exameDaAgenda(clinicaId: string, id: string) {
  const a = await prisma.agendamento.findFirst({ where: { id, clinicaId, tipoConsulta: TIPO_EXAME } })
  if (!a) throw erro('Agendamento não encontrado', 404)
  return a
}

export async function marcarRealizado(clinicaId: string, id: string) {
  const a = await exameDaAgenda(clinicaId, id)
  if (a.status !== 'confirmado') throw erro('Só exames confirmados podem ser marcados como realizados')
  if (a.inicioEm && a.inicioEm > new Date()) throw erro('O exame ainda não começou')
  await prisma.agendamento.update({ where: { id }, data: updating({ status: 'realizado' }) })
  return { status: 'realizado' }
}

export async function cancelarPelaClinica(clinicaId: string, id: string, motivo: unknown) {
  const texto = typeof motivo === 'string' ? motivo.trim().slice(0, 255) : ''
  if (!texto) throw erro('Informe o motivo do cancelamento')
  const a = await exameDaAgenda(clinicaId, id)
  if (!podeSerCancelado(a.status)) throw erro('Este agendamento não pode ser cancelado')
  await prisma.agendamento.update({
    where: { id },
    data: updating({ status: 'cancelado', motivoCancelamento: texto, canceladoEm: prepareDateTimeString(DateTime.now()) }),
  })
  after(() => avisarExame('cancelado_clinica', id, texto))
  return { status: 'cancelado' }
}
