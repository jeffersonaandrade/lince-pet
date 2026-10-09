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
import { nomeCompleto, podeSerCancelado, prepareDataConsulta } from '@/server/services/agendamentos'
import { horarioEstaBloqueado, MENSAGEM_HORARIO_BLOQUEADO } from '@/server/services/bloqueios'

/** PATCH /agendamentos/:id/reagendar */
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

  const { data_consulta, horario_consulta } = apiReq.body

  if (!data_consulta || !horario_consulta) {
    return badRequest({ message: 'Campos obrigatórios: data_consulta e horario_consulta' })
  }

  const dataConsultaObj = DateTime.fromISO(data_consulta)
  const hoje = DateTime.now().startOf('day')

  if (dataConsultaObj < hoje) {
    return badRequest({ message: 'Não é possível reagendar consultas para datas passadas' })
  }

  const horario = String(horario_consulta)

  try {
    const result = await prisma.$transaction(async (tx) => {
      const agendamento = await tx.agendamento.findFirst({ where: { id, tutorId: tutor.id } })

      if (!agendamento) {
        return notFound({ message: 'Agendamento não encontrado' })
      }

      if (!podeSerCancelado(agendamento.status)) {
        return badRequest({ message: 'Este agendamento não pode ser reagendado' })
      }

      const agendamentoExistente = await tx.agendamento.findFirst({
        where: {
          veterinarioId: agendamento.veterinarioId,
          dataConsulta: dataConsultaObj.toSQLDate(),
          horarioConsulta: horario,
          id: { not: agendamento.id },
          status: { in: ['pendente', 'confirmado'] },
        },
      })

      if (agendamentoExistente) {
        return badRequest({ message: 'O novo horário já está ocupado. Escolha outro horário.' })
      }

      if (
        agendamento.veterinarioId &&
        (await horarioEstaBloqueado(agendamento.veterinarioId, dataConsultaObj.toSQLDate()!, horario))
      ) {
        return badRequest({ message: MENSAGEM_HORARIO_BLOQUEADO })
      }

      return tx.agendamento.update({
        where: { id: agendamento.id },
        data: updating({
          dataConsulta: prepareDataConsulta(dataConsultaObj),
          horarioConsulta: horario,
          status: 'pendente',
        }),
      })
    })

    if (result instanceof Response) return result
    const agendamento = result
    const data = dataConsultaObj.toFormat('dd/MM/yyyy')

    after(() => notificarAgendamento('remarcacao', agendamento.id, ['tutor', 'profissional']))
    after(() => googleCalendar.sincronizarEvento(agendamento.id, 'atualizar'))

    try {
      const veterinario = agendamento.veterinarioId
        ? await prisma.veterinario.findFirst({ where: { id: agendamento.veterinarioId }, include: { user: true } })
        : null
      const vetUser = veterinario!.user!

      if (podeEnviarEmail(user)) {
        await notifications.sendAppointmentRescheduled(user.email, {
          nomeTutor: user.nome,
          nomeVeterinario: nomeCompleto(vetUser),
          data,
          horario: agendamento.horarioConsulta,
          tipo: agendamento.tipoConsulta,
          localNome: agendamento.localNome,
          verificationCode: agendamento.startCode || '',
        })
      }

      if (podeEnviarEmail(vetUser)) {
        await notifications.sendAppointmentRescheduledToVeterinarian(vetUser.email, {
          nomeVeterinario: nomeCompleto(vetUser),
          nomeTutor: nomeCompleto(user),
          data,
          horario: agendamento.horarioConsulta,
          tipo: agendamento.tipoConsulta,
          localNome: agendamento.localNome,
        })
      }

      await inAppNotifications.notifyAppointmentRescheduledToVet({
        veterinarioUserId: vetUser.id,
        tutorNome: nomeCompleto(user),
        dataConsulta: data,
        horarioConsulta: agendamento.horarioConsulta!,
        agendamentoId: agendamento.id,
      })
    } catch (notifError) {
      console.error('❌ Erro ao notificar reagendamento:', notifError)
    }

    return ok({
      message: 'Agendamento reagendado com sucesso',
      agendamento: {
        id: agendamento.id,
        data_consulta: data,
        horario_consulta: agendamento.horarioConsulta,
        status: agendamento.status,
      },
    })
  } catch (error) {
    console.error('Erro ao reagendar agendamento:', error)
    return serverError({ message: 'Erro interno do servidor ao reagendar agendamento' })
  }
})
