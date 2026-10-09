import { DateTime } from 'luxon'
import { prisma } from '@/server/db'
import { ApiRequest, badRequest, notFound, ok, route, serverError } from '@/server/http'
import { updating } from '@/server/lucid'
import { requireUser } from '@/server/auth/session'
import { findVeterinarioByUser, statusNormalizado } from '@/server/services/veterinario-dashboard'

const MAX_ATTEMPTS = 5

export const PATCH = route<{ id: string }>(async (req, { id }) => {
  const apiReq = await ApiRequest.from(req)
  const user = await requireUser(apiReq, ['veterinario'])
  try {
    const veterinario = await findVeterinarioByUser(user.id)
    if (!veterinario) return badRequest({ message: 'Veterinário não encontrado' })

    const agendamento = await prisma.agendamento.findFirst({ where: { id, veterinarioId: veterinario.id } })
    if (!agendamento) return notFound({ message: 'Agendamento não encontrado' })

    const { code } = apiReq.only(['code']) as { code?: unknown }
    if (!code || typeof code !== 'string') return badRequest({ message: 'Código é obrigatório' })

    const statusAtual = statusNormalizado(agendamento.status)
    if (statusAtual === 'cancelado') {
      return badRequest({ message: 'Agendamento cancelado não pode ser iniciado' })
    }
    if (statusAtual === 'realizado') return badRequest({ message: 'Agendamento já foi concluído' })

    const attempts = agendamento.startCodeAttempts ?? 0
    if (attempts >= MAX_ATTEMPTS) {
      return badRequest({ message: 'Muitas tentativas inválidas. Tente novamente mais tarde.' })
    }

    const now = new Date()
    if (!agendamento.startCode || !agendamento.startCodeExpiresAt) {
      return badRequest({ message: 'Este agendamento não possui código ativo' })
    }
    if (now > agendamento.startCodeExpiresAt) return badRequest({ message: 'Código expirado' })
    if (code !== agendamento.startCode) {
      await prisma.agendamento.update({
        where: { id: agendamento.id },
        data: updating({ startCodeAttempts: attempts + 1 }),
      })
      return badRequest({ message: 'Código inválido' })
    }

    const status = 'em andamento'
    await prisma.agendamento.update({
      where: { id: agendamento.id },
      data: updating({ startCodeUsedAt: now, startedAt: now, status }),
    })

    return ok({
      message: 'Consulta iniciada com sucesso',
      status,
      started_at: DateTime.fromJSDate(now).toISO(),
    })
  } catch (error) {
    console.error('❌ [Dashboard] Erro ao iniciar agendamento:', error)
    return serverError({ message: 'Erro interno ao iniciar agendamento' })
  }
})
