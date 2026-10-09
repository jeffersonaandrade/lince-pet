import { prisma } from '@/server/db'
import { ApiRequest, badRequest, created, notFound, route, serverError } from '@/server/http'
import { requireUser } from '@/server/auth/session'
import { creating } from '@/server/lucid'
import { inAppNotifications } from '@/server/services/in-app-notifications'
import { createAvaliacaoValidator } from '@/server/validators/avaliacao'

function statusNormalizado(status: string | null) {
  const s = status?.toLowerCase() || ''
  if (['pendente', 'agendado', 'marcado'].includes(s)) return 'pendente'
  if (['confirmado', 'confirmada'].includes(s)) return 'confirmado'
  if (['realizado', 'finalizado', 'concluido'].includes(s)) return 'realizado'
  if (['cancelado', 'cancelada'].includes(s)) return 'cancelado'
  return 'desconhecido'
}

export const POST = route<{ id: string }>(async (req, { id }) => {
  const request = await ApiRequest.from(req)
  const user = await requireUser(request)
  const payload = await createAvaliacaoValidator.validate(request.all())
  try {
    const tutor = await prisma.tutor.findFirst({ where: { userId: user.id } })
    if (!tutor) return badRequest({ message: 'Apenas tutores podem avaliar' })

    const agendamento = await prisma.agendamento.findFirst({ where: { id, tutorId: tutor.id } })
    if (!agendamento) return notFound({ message: 'Agendamento não encontrado' })

    if (statusNormalizado(agendamento.status) !== 'realizado') {
      return badRequest({ message: 'Só é possível avaliar atendimentos concluídos' })
    }

    const jaAvaliado = await prisma.avaliacao.findFirst({ where: { agendamentoId: agendamento.id } })
    if (jaAvaliado) return badRequest({ message: 'Este agendamento já foi avaliado' })

    const avaliacao = await prisma.avaliacao.create({
      data: creating({
        agendamentoId: agendamento.id,
        tutorId: tutor.id,
        veterinarioId: agendamento.veterinarioId,
        prestadorId: agendamento.prestadorId,
        estrelas: payload.estrelas,
        comentario: payload.comentario || null,
        clinicaId: agendamento.clinicaId || null,
        estrelasClinica: payload.estrelasClinica || null,
        comentarioClinica: payload.comentarioClinica || null,
      }),
    })

    try {
      const tutorNome = `${user.nome} ${user.sobrenome ?? ''}`.trim()
      const vet = agendamento.veterinarioId
        ? await prisma.veterinario.findFirst({ where: { id: agendamento.veterinarioId }, include: { user: true } })
        : null

      if (vet) {
        await inAppNotifications.notifyNewReviewToVet({
          veterinarioUserId: vet.user!.id,
          tutorNome,
          estrelas: payload.estrelas,
          agendamentoId: agendamento.id,
        })

        if (agendamento.clinicaId && payload.estrelasClinica) {
          const clinica = await prisma.clinica.findFirst({
            where: { id: agendamento.clinicaId },
            include: { user: true },
          })
          if (clinica) {
            await inAppNotifications.notifyNewReviewToClinica({
              clinicaUserId: clinica.user!.id,
              tutorNome,
              estrelas: payload.estrelasClinica,
              agendamentoId: agendamento.id,
            })
          }
        }
      }

      const prestador = agendamento.prestadorId
        ? await prisma.prestador.findFirst({ where: { id: agendamento.prestadorId } })
        : null
      if (prestador) {
        await inAppNotifications.createGenericNotification({
          userId: prestador.userId,
          type: 'NOVA_AVALIACAO',
          title: 'Nova avaliação',
          message: `${tutorNome} avaliou seu serviço com ${payload.estrelas} estrela(s).`,
          actionData: { agendamentoId: agendamento.id, pedido: true },
        })
      }
    } catch (notifErr) {
      console.error('❌ Erro ao enviar notificação de avaliação:', notifErr)
    }

    return created({
      message: 'Avaliação registrada com sucesso',
      avaliacao: {
        id: avaliacao.id,
        estrelas: avaliacao.estrelas,
        comentario: avaliacao.comentario,
        estrelasClinica: avaliacao.estrelasClinica,
        comentarioClinica: avaliacao.comentarioClinica,
        created_at: avaliacao.createdAt,
      },
    })
  } catch (error) {
    console.error('Erro ao criar avaliação:', error)
    return serverError({ message: 'Erro interno ao criar avaliação' })
  }
})
