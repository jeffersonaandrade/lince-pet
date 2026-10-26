import { after } from 'next/server'
import { ApiRequest, badRequest, HttpError, json, ok, route, serverError } from '@/server/http'
import { requireUser } from '@/server/auth/session'
import { nomeCompleto } from '@/server/services/agendamentos'
import { aceitarConsultaDomicilio } from '@/server/services/consulta-domicilio'
import { googleCalendar } from '@/server/services/google-calendar'
import { inAppNotifications } from '@/server/services/in-app-notifications'
import { findVeterinarioByUser } from '@/server/services/veterinario-dashboard'

/** PATCH /veterinarios/agendamentos/:id/aceitar */
export const PATCH = route<{ id: string }>(async (req, { id }) => {
  const user = await requireUser(await ApiRequest.from(req), ['veterinario'])
  const veterinario = await findVeterinarioByUser(user.id)
  if (!veterinario) return badRequest({ message: 'Veterinário não encontrado' })

  try {
    const { agendamento, novo } = await aceitarConsultaDomicilio(veterinario.id, id)
    if (novo) {
      const tutorUserId = agendamento.tutor?.userId
      const vetUser = agendamento.veterinario?.user
      const data = agendamento.dataConsulta?.slice(0, 10).split('-').reverse().join('/') ?? ''
      after(async () => {
        await googleCalendar.sincronizarEvento(agendamento.id, 'criar')
        if (!tutorUserId || !vetUser) return
        try {
          await inAppNotifications.notifyAppointmentConfirmedToTutor({
            tutorUserId,
            veterinarioNome: nomeCompleto(vetUser),
            dataConsulta: data,
            horarioConsulta: agendamento.horarioConsulta || '',
            agendamentoId: agendamento.id,
          })
        } catch (error) {
          console.error('Erro ao avisar o tutor do aceite da consulta em domicílio:', error)
        }
      })
    }
    return ok({
      message: novo ? 'Atendimento aceito. O endereço completo está liberado.' : 'Atendimento já aceito.',
      status: agendamento.status,
      local_endereco: agendamento.localEndereco,
    })
  } catch (error) {
    if (error instanceof HttpError) return json(error.body, error.status)
    console.error('Erro ao aceitar consulta em domicílio:', error)
    return serverError({ message: 'Erro ao aceitar o atendimento' })
  }
})
