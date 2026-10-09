import { after } from 'next/server'
import { DateTime } from 'luxon'
import { prisma } from '@/server/db'
import { ApiRequest, badRequest, notFound, ok, route, serverError, unauthorized } from '@/server/http'
import { updating } from '@/server/lucid'
import { requireUser } from '@/server/auth/session'
import { inAppNotifications } from '@/server/services/in-app-notifications'
import { notifications } from '@/server/services/notifications'
import { notificarAgendamento } from '@/server/services/whatsapp-notificacoes'
import { podeEnviarEmail } from '@/server/services/canais-notificacao'
import { googleCalendar } from '@/server/services/google-calendar'
import {
  consumeDataConsulta,
  nomeCompleto,
  podeSerCancelado,
  prepareDateTimeString,
} from '@/server/services/agendamentos'

/** PATCH /agendamentos/:id/cancelar */
export const PATCH = route<{ id: string }>(async (req, { id }) => {
  const apiReq = await ApiRequest.from(req)
  const user = await requireUser(apiReq)
  if (!user) {
    return unauthorized({ message: 'Usuário não autenticado' })
  }

  const tutor = await prisma.tutor.findFirst({ where: { userId: user.id } })
  if (!tutor) {
    return badRequest({ message: 'Usuário não é um tutor válido' })
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const agendamento = await tx.agendamento.findFirst({ where: { id, tutorId: tutor.id } })

      if (!agendamento) {
        return notFound({ message: 'Agendamento não encontrado' })
      }

      if (!podeSerCancelado(agendamento.status)) {
        return badRequest({ message: 'Este agendamento não pode ser cancelado' })
      }

      const { motivo } = apiReq.body

      const atualizado = await tx.agendamento.update({
        where: { id: agendamento.id },
        data: updating({
          status: 'cancelado',
          motivoCancelamento: String(motivo || 'Cancelado pelo tutor'),
          canceladoEm: prepareDateTimeString(DateTime.now()),
        }),
      })

      const vet = agendamento.veterinarioId
        ? await tx.veterinario.findFirst({ where: { id: agendamento.veterinarioId } })
        : null

      if (vet && (vet.monthlyAppointmentsUsed ?? 0) > 0) {
        await tx.veterinario.update({
          where: { id: vet.id },
          data: updating({ monthlyAppointmentsUsed: vet.monthlyAppointmentsUsed! - 1 }),
        })
      }

      return { agendamento: atualizado, motivo }
    })

    if (result instanceof Response) return result
    const { agendamento, motivo } = result

    after(() => notificarAgendamento('cancelamento', agendamento.id, ['profissional'], { motivo: motivo || null }))
    after(() => googleCalendar.sincronizarEvento(agendamento.id, 'cancelar'))

    try {
      const veterinario = agendamento.veterinarioId
        ? await prisma.veterinario.findFirst({ where: { id: agendamento.veterinarioId }, include: { user: true } })
        : null
      const vetUser = veterinario!.user!
      console.log(`📧 [Agendamento] Tutor: ${tutor.id}, User: ${user.id}, Email: ${user.email}`)

      const data = consumeDataConsulta(agendamento.dataConsulta)!.toFormat('dd/MM/yyyy')

      await inAppNotifications.notifyAppointmentCancelledToVet({
        veterinarioUserId: vetUser.id,
        tutorNome: nomeCompleto(user),
        dataConsulta: data,
        horarioConsulta: agendamento.horarioConsulta!,
        agendamentoId: agendamento.id,
      })

      const emailPayload = {
        nomeTutor: user.nome,
        nomeVeterinario: nomeCompleto(vetUser),
        data,
        horario: agendamento.horarioConsulta,
        motivo: motivo || null,
      }

      if (podeEnviarEmail(user)) {
        await notifications.sendAppointmentCancellation(user.email, { ...emailPayload, isVeterinario: false })
      }
      if (podeEnviarEmail(vetUser)) {
        await notifications.sendAppointmentCancellation(vetUser.email, { ...emailPayload, isVeterinario: true })
      }
    } catch (notifError) {
      console.error('❌ [Agendamento] Erro ao enviar notificações de cancelamento:', notifError)
    }

    return ok({ message: 'Agendamento cancelado com sucesso' })
  } catch (error) {
    console.error('Erro ao cancelar agendamento:', error)
    return serverError({ message: 'Erro interno do servidor ao cancelar agendamento' })
  }
})
