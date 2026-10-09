import { prisma } from '@/server/db'
import { ApiRequest, badRequest, ok, route, serverError, unauthorized } from '@/server/http'
import { requireUser } from '@/server/auth/session'
import { inAppNotifications } from '@/server/services/in-app-notifications'
import { serializeRelatedUser } from '@/server/services/clinicas'

export const GET = route(async (req) => {
  const currentUser = await requireUser(await ApiRequest.from(req))
  if (!currentUser.clinica) {
    return unauthorized({ message: 'Usuário não autenticado ou não é clínica' })
  }

  try {
    const vinculos = await prisma.veterinarioClinica.findMany({
      where: { clinicaId: currentUser.clinica.id, status: 'aceito' },
      include: { veterinario: { include: { user: true } } },
    })
    const profissionais = vinculos.map(({ veterinario: { user, ...vet } }) => ({
      ...vet,
      user: serializeRelatedUser(user),
    }))
    return ok({ profissionais })
  } catch (error) {
    console.error(error)
    return serverError({ message: 'Erro ao buscar profissionais' })
  }
})

export const POST = route(async (req) => {
  const request = await ApiRequest.from(req)
  const currentUser = await requireUser(request)
  if (!currentUser.clinica) {
    return unauthorized({ message: 'Usuário não autenticado ou não é clínica' })
  }

  const { veterinarioId } = request.only(['veterinarioId'])
  if (!veterinarioId) {
    return badRequest({ message: 'ID do veterinário é obrigatório' })
  }

  try {
    const clinica = currentUser.clinica
    const vetId = String(veterinarioId)

    const existing = await prisma.veterinarioClinica.findFirst({
      where: { clinicaId: clinica.id, veterinarioId: vetId },
    })
    if (existing) {
      return badRequest({
        message: 'Veterinário já possui vínculo ou solicitação pendente com esta clínica',
      })
    }

    await prisma.veterinarioClinica.create({
      data: { clinicaId: clinica.id, veterinarioId: vetId, status: 'pendente', ativo: 0 },
    })

    try {
      const vet = await prisma.veterinario.findFirst({ where: { id: vetId }, include: { user: true } })
      if (vet) {
        await inAppNotifications.notifyClinicLinkRequest({
          veterinarioUserId: vet.user!.id,
          clinicaNome: clinica.nomeClinica as string,
          clinicaId: clinica.id,
        })
      }
    } catch (notifErr) {
      console.error('❌ Erro ao enviar notificação de vínculo:', notifErr)
    }

    return ok({ message: 'Solicitação de vínculo enviada com sucesso' })
  } catch (error) {
    console.error(error)
    return serverError({ message: 'Erro ao vincular veterinário' })
  }
})
