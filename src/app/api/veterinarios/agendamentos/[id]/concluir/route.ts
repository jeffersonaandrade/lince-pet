import { prisma } from '@/server/db'
import { ApiRequest, badRequest, notFound, ok, route, serverError } from '@/server/http'
import { updating } from '@/server/lucid'
import { requireUser } from '@/server/auth/session'
import { inAppNotifications } from '@/server/services/in-app-notifications'
import { findVeterinarioByUser, statusNormalizado } from '@/server/services/veterinario-dashboard'

export const PATCH = route<{ id: string }>(async (req, { id }) => {
  const user = await requireUser(await ApiRequest.from(req), ['veterinario'])
  try {
    const veterinario = await findVeterinarioByUser(user.id)
    if (!veterinario) return badRequest({ message: 'Veterinário não encontrado' })

    const agendamento = await prisma.agendamento.findFirst({
      where: { id, veterinarioId: veterinario.id },
      include: { tutor: { include: { user: true } } },
    })
    if (!agendamento) return notFound({ message: 'Agendamento não encontrado' })

    if (statusNormalizado(agendamento.status) === 'cancelado') {
      return badRequest({ message: 'Não é possível concluir um agendamento cancelado' })
    }

    if (statusNormalizado(agendamento.status) === 'realizado') return ok({ message: 'Agendamento já concluído', status: 'realizado' })
    if (agendamento.status.toLowerCase() !== 'em andamento' || !agendamento.startedAt || !agendamento.startCodeUsedAt) {
      return badRequest({ message: 'Inicie a consulta com o código do tutor antes de concluir.' })
    }

    const status = 'realizado'
    const concluido = await prisma.agendamento.updateMany({
      where: { id: agendamento.id, status: agendamento.status, startedAt: { not: null }, startCodeUsedAt: { not: null } },
      data: updating({ status, endedAt: new Date() }),
    })
    if (concluido.count !== 1) return badRequest({ message: 'Agendamento alterado. Atualize a página.' })

    try {
      await inAppNotifications.notifyAppointmentCompletedToTutor({
        tutorUserId: agendamento.tutor!.user!.id,
        veterinarioNome: `${user.nome} ${user.sobrenome ?? ''}`.trim(),
        agendamentoId: agendamento.id,
      })
    } catch (notifErr) {
      console.error('❌ [Dashboard] Erro ao enviar notificação de conclusão:', notifErr)
    }

    return ok({ message: 'Agendamento concluído com sucesso', status })
  } catch (error) {
    console.error('❌ [Dashboard] Erro ao concluir agendamento:', error)
    return serverError({ message: 'Erro interno ao concluir agendamento' })
  }
})
