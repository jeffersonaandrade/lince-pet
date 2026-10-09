import 'server-only'
import vine from '@vinejs/vine'
import { DateTime } from 'luxon'
import type { Prisma, RegistroClinico } from '@prisma/client'
import { prisma } from '../db'
import { HttpError } from '../http'
import { creating, updating } from '../lucid'
import type { CurrentUser } from '../auth/session'
import { MENSAGEM_ANOTACAO_INDISPONIVEL, podeAnotar } from './anotacoes'
import { recebeuEncaminhamentoDoPet } from './encaminhamentos'

/**
 * Prontuário do pet: consultas não canceladas + registro clínico de cada uma.
 * Visível ao tutor dono e a vets/clínicas com consulta não cancelada do pet.
 * A anotação privada (AgendamentoAnotacao) nunca entra aqui.
 */

export const MAX_TEXTO_REGISTRO = 5000
export const PESO_MAXIMO_KG = 500

const NAO_CANCELADO: Prisma.StringFilter = { notIn: ['cancelado', 'cancelada'] }

const texto = () => vine.string().trim().maxLength(MAX_TEXTO_REGISTRO).optional().nullable()

const registroValidator = vine.compile(
  vine.object({
    queixa: texto(),
    diagnostico: texto(),
    tratamento: texto(),
    peso_kg: vine.number().min(0).max(PESO_MAXIMO_KG).optional().nullable(),
    vacinas_medicacoes: texto(),
    retorno_sugerido: vine.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
    plano_saude: vine.string().trim().maxLength(255).optional().nullable(),
    encaminhamento: texto(),
  })
)

export async function validarRegistro(body: unknown, hoje = DateTime.now().toISODate()!) {
  const data = await registroValidator.validate(body)
  const retorno = data.retorno_sugerido || null
  if (retorno && (!DateTime.fromISO(retorno).isValid || retorno < hoje)) {
    throw new HttpError(422, { message: 'A data de retorno deve ser hoje ou uma data futura' })
  }
  return {
    queixa: data.queixa || null,
    diagnostico: data.diagnostico || null,
    tratamento: data.tratamento || null,
    pesoKg: data.peso_kg ?? null,
    vacinasMedicacoes: data.vacinas_medicacoes || null,
    retornoSugerido: retorno,
    planoSaude: data.plano_saude || null,
    encaminhamento: data.encaminhamento || null,
  }
}

export const serializeRegistro = (r: RegistroClinico | null) =>
  r && {
    id: r.id,
    agendamento_id: r.agendamentoId,
    queixa: r.queixa,
    diagnostico: r.diagnostico,
    tratamento: r.tratamento,
    peso_kg: r.pesoKg === null ? null : Number(r.pesoKg),
    vacinas_medicacoes: r.vacinasMedicacoes,
    retorno_sugerido: r.retornoSugerido,
    plano_saude: r.planoSaude,
    encaminhamento: r.encaminhamento,
    updated_at: r.updatedAt,
  }

async function findAgendamentoDoVet(agendamentoId: string, veterinarioId: string) {
  const agendamento = await prisma.agendamento.findFirst({ where: { id: agendamentoId, veterinarioId } })
  if (!agendamento) throw new HttpError(404, { message: 'Agendamento não encontrado' })
  return agendamento
}

export async function obterRegistro(agendamentoId: string, veterinarioId: string) {
  await findAgendamentoDoVet(agendamentoId, veterinarioId)
  return prisma.registroClinico.findUnique({ where: { agendamentoId } })
}

/** Só o vet da consulta escreve; liberado a partir do início do atendimento (mesma regra da anotação). */
export async function salvarRegistro(agendamentoId: string, veterinarioId: string, body: unknown) {
  const agendamento = await findAgendamentoDoVet(agendamentoId, veterinarioId)
  if (!agendamento.petId) throw new HttpError(400, { message: 'Consulta sem pet vinculado' })
  if (!podeAnotar(agendamento)) throw new HttpError(400, { message: MENSAGEM_ANOTACAO_INDISPONIVEL })

  const data = await validarRegistro(body)
  return prisma.registroClinico.upsert({
    where: { agendamentoId },
    create: creating({ agendamentoId, petId: agendamento.petId, veterinarioId, ...data }),
    update: updating(data),
  })
}

const NAO_ENCONTRADO = () => new HttpError(404, { message: 'Prontuário não encontrado' })

/**
 * Tutor dono; vet/clínica com consulta não cancelada do pet; ou destino de encaminhamento enviado/aceito do pet
 * (inclui prestador). Demais casos: 404.
 */
export async function assertAcessoProntuario(user: CurrentUser, petId: string) {
  const pet = await prisma.pet.findUnique({ where: { id: petId } })
  if (!pet) throw NAO_ENCONTRADO()

  if (user.userType === 'tutor') {
    if (user.tutor && pet.tutorId === user.tutor.id) return pet
    throw NAO_ENCONTRADO()
  }

  const vinculo: Prisma.AgendamentoWhereInput | null =
    user.userType === 'veterinario' && user.veterinario
      ? { veterinarioId: user.veterinario.id }
      : user.userType === 'clinica' && user.clinica
        ? { clinicaId: user.clinica.id }
        : null

  if (vinculo && (await prisma.agendamento.count({ where: { petId, status: NAO_CANCELADO, ...vinculo } }))) return pet
  if (await recebeuEncaminhamentoDoPet(user, petId)) return pet
  throw NAO_ENCONTRADO()
}

const nomeCompleto = (u?: { nome: string | null; sobrenome: string | null } | null) =>
  [u?.nome, u?.sobrenome].filter(Boolean).join(' ') || null

export async function prontuarioDoPet(petId: string) {
  const consultas = await prisma.agendamento.findMany({
    where: { petId, status: NAO_CANCELADO },
    select: {
      id: true,
      dataConsulta: true,
      horarioConsulta: true,
      tipoConsulta: true,
      status: true,
      localNome: true,
      veterinario: { select: { user: { select: { nome: true, sobrenome: true } } } },
      clinica: { select: { nomeClinica: true } },
      registroClinico: true,
    },
    orderBy: [{ dataConsulta: 'desc' }, { horarioConsulta: 'desc' }],
  })

  return consultas.map((c) => ({
    agendamento_id: c.id,
    data_consulta: c.dataConsulta,
    horario_consulta: c.horarioConsulta,
    tipo_consulta: c.tipoConsulta,
    status: c.status,
    local_nome: c.localNome,
    veterinario_nome: nomeCompleto(c.veterinario?.user),
    clinica_nome: c.clinica?.nomeClinica ?? null,
    registro: serializeRegistro(c.registroClinico),
  }))
}

export const serializePetProntuario = (pet: {
  id: string
  nome: string
  especie: string
  raca: string | null
  idade: number | null
  porte: string | null
  fotoUrl: string | null
}) => ({
  id: pet.id,
  nome: pet.nome,
  especie: pet.especie,
  raca: pet.raca,
  idade: pet.idade,
  porte: pet.porte,
  foto_url: pet.fotoUrl,
})
