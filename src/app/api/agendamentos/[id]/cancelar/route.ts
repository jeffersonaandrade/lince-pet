import { liberarCotasVeterinario } from '@/server/services/cotas-veterinario'
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
import { cancelarPedidoPeloTutor, ehPedidoDePrestador } from '@/server/services/pedidos-prestador'
import { cancelarExamePeloTutor, ehAgendamentoDeExame } from '@/server/services/exames'
import { MOTIVO_PADRAO_TUTOR, motivoDoTutor } from '@/lib/motivos-cancelamento'
import {
  consumeDataConsulta,
  nomeCompleto,
  podeSerCancelado,
  prepareDateTimeString,
} from '@/server/services/agendamentos'

/** PATCH /agendamentos/:id/cancelar */
export const PATCH = route<{ id: string }>(async (req, { id }) => {
  const apiReq = await ApiRequest.from(req)
  const user = await requireUser(apiReq, ['tutor'])
  if (!user) {
    return unauthorized({ message: 'Usuário não autenticado' })
  }

  const tutor = await prisma.tutor.findFirst({ where: { userId: user.id } })
  if (!tutor) {
    return badRequest({ message: 'Usuário não é um tutor válido' })
  }

  const motivoInformado = motivoDoTutor(apiReq.text('motivo'))

  if (await ehPedidoDePrestador(id, tutor.id)) {
    await cancelarPedidoPeloTutor(tutor.id, id, motivoInformado)
    return ok({ message: 'Pedido cancelado com sucesso' })
  }
  if (await ehAgendamentoDeExame(id, tutor.id)) {
    await cancelarExamePeloTutor(tutor.id, id, motivoInformado)
    return ok({ message: 'Exame cancelado com sucesso' })
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`inicio:${id}`}, 0))`
      const agendamento = await tx.agendamento.findFirst({ where: { id, tutorId: tutor.id } })

      if (!agendamento) {
        return notFound({ message: 'Agendamento não encontrado' })
      }

      if (agendamento.startedAt || !podeSerCancelado(agendamento.status)) {
        return badRequest({ message: 'Este agendamento não pode ser cancelado' })
      }

      const motivo = motivoInformado

      const atualizado = await tx.agendamento.update({
        where: { id: agendamento.id },
        data: updating({
          status: 'cancelado',
          motivoCancelamento: motivo || MOTIVO_PADRAO_TUTOR,
          canceladoEm: prepareDateTimeString(DateTime.now()),
        }),
      })

      if (agendamento.veterinarioId) await liberarCotasVeterinario(tx, agendamento.veterinarioId, [agendamento.id])

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
