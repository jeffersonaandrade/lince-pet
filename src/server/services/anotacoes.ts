import 'server-only'
import vine from '@vinejs/vine'
import type { Agendamento, AgendamentoAnotacao } from '@prisma/client'
import { prisma } from '../db'
import { HttpError } from '../http'
import { creating, updating } from '../lucid'
import { statusNormalizado } from './veterinario-dashboard'

/**
 * Anotação privada do veterinário sobre a consulta.
 * Só o veterinário dono lê/edita; nunca incluir em respostas para tutor ou clínica.
 * Os campos de pagamento são apenas registro do vet (não alteram payment_status nem o Asaas).
 */

export const STATUS_PAGAMENTO = ['pago', 'pendente', 'isento'] as const
export const FORMAS_PAGAMENTO = ['pix', 'cartao', 'dinheiro', 'plano_pet', 'outro'] as const
export const MAX_OBSERVACOES = 5000

export const MENSAGEM_ANOTACAO_INDISPONIVEL = 'A anotação fica disponível a partir do início do atendimento'

/** Liberada a partir do início do atendimento (startedAt) e após a conclusão; nunca em cancelada. */
export function podeAnotar(agendamento: Pick<Agendamento, 'status' | 'startedAt'>) {
  const status = statusNormalizado(agendamento.status)
  if (status === 'cancelado') return false
  return Boolean(agendamento.startedAt) || status === 'realizado'
}

const anotacaoValidator = vine.compile(
  vine.object({
    local_atendimento: vine.string().trim().maxLength(255).optional().nullable(),
    status_pagamento: vine.enum(STATUS_PAGAMENTO).optional().nullable(),
    forma_pagamento: vine.enum(FORMAS_PAGAMENTO).optional().nullable(),
    plano_nome: vine.string().trim().maxLength(255).optional().nullable(),
    observacoes: vine.string().trim().maxLength(MAX_OBSERVACOES).optional().nullable(),
  })
)

export async function validarAnotacao(body: unknown) {
  const data = await anotacaoValidator.validate(body)
  return {
    localAtendimento: data.local_atendimento || null,
    statusPagamento: data.status_pagamento || null,
    formaPagamento: data.forma_pagamento || null,
    planoNome: data.forma_pagamento === 'plano_pet' ? data.plano_nome || null : null,
    observacoes: data.observacoes || null,
  }
}

export const serializeAnotacao = (a: AgendamentoAnotacao | null) =>
  a && {
    id: a.id,
    agendamento_id: a.agendamentoId,
    local_atendimento: a.localAtendimento,
    status_pagamento: a.statusPagamento,
    forma_pagamento: a.formaPagamento,
    plano_nome: a.planoNome,
    observacoes: a.observacoes,
    updated_at: a.updatedAt,
  }

async function findAgendamentoDoVet(agendamentoId: string, veterinarioId: string) {
  const agendamento = await prisma.agendamento.findFirst({ where: { id: agendamentoId, veterinarioId } })
  if (!agendamento) throw new HttpError(404, { message: 'Agendamento não encontrado' })
  return agendamento
}

export async function obterAnotacao(agendamentoId: string, veterinarioId: string) {
  await findAgendamentoDoVet(agendamentoId, veterinarioId)
  return prisma.agendamentoAnotacao.findUnique({ where: { agendamentoId } })
}

/**
 * Histórico do pet da consulta: só as anotações do próprio veterinário em outras consultas do mesmo pet.
 * Anotações de outros veterinários nunca entram (a anotação é privada de quem escreveu).
 */
export async function historicoDoPet(agendamentoId: string, veterinarioId: string) {
  const agendamento = await findAgendamentoDoVet(agendamentoId, veterinarioId)
  if (!agendamento.petId) return []

  const anotacoes = await prisma.agendamentoAnotacao.findMany({
    where: {
      veterinarioId,
      agendamentoId: { not: agendamentoId },
      agendamento: { petId: agendamento.petId, veterinarioId },
    },
    include: {
      agendamento: { select: { dataConsulta: true, horarioConsulta: true, status: true, tipoConsulta: true } },
    },
    orderBy: [{ agendamento: { dataConsulta: 'desc' } }, { createdAt: 'desc' }],
  })

  return anotacoes.map(({ agendamento: a, ...anotacao }) => ({
    ...serializeAnotacao(anotacao)!,
    data_consulta: a.dataConsulta,
    horario_consulta: a.horarioConsulta,
    status_consulta: a.status,
    tipo_consulta: a.tipoConsulta,
  }))
}

export async function salvarAnotacao(agendamentoId: string, veterinarioId: string, body: unknown) {
  const agendamento = await findAgendamentoDoVet(agendamentoId, veterinarioId)
  if (!podeAnotar(agendamento)) throw new HttpError(400, { message: MENSAGEM_ANOTACAO_INDISPONIVEL })

  const data = await validarAnotacao(body)
  return prisma.agendamentoAnotacao.upsert({
    where: { agendamentoId },
    create: creating({ agendamentoId, veterinarioId, ...data }),
    update: updating(data),
  })
}
