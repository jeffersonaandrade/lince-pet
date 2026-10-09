import { prisma } from '@/server/db'
import { ApiRequest, notFound, ok, route, serverError } from '@/server/http'
import { requireUser } from '@/server/auth/session'
import { updating } from '@/server/lucid'

const paraBool = (v: unknown) => v === true || v === 1 || v === '1' || v === 'true'

/** GET /tutor/profile (preferências do tutor) */
export const GET = route(async (req) => {
  const user = await requireUser(await ApiRequest.from(req), ['tutor'])
  return ok({ whatsapp_opt_in: user.tutor ? user.tutor.whatsappOptIn !== 0 : true })
})

export const PUT = route(async (req) => {
  const request = await ApiRequest.from(req)
  const user = await requireUser(request, ['tutor'])
  try {
    const { nome, whatsapp_opt_in } = request.only(['nome', 'whatsapp_opt_in'])

    const dbUser = await prisma.user.findUnique({ where: { id: user.id } })
    if (!dbUser) return notFound({ message: 'Usuário não encontrado' })

    if (nome && String(nome) !== dbUser.nome) {
      await prisma.user.update({ where: { id: dbUser.id }, data: updating({ nome: String(nome) }) })
    }

    if (whatsapp_opt_in !== undefined && user.tutor) {
      const optIn = paraBool(whatsapp_opt_in) ? 1 : 0
      if (optIn !== user.tutor.whatsappOptIn) {
        await prisma.tutor.update({ where: { id: user.tutor.id }, data: updating({ whatsappOptIn: optIn }) })
      }
    }

    return ok({ message: 'Perfil atualizado com sucesso' })
  } catch (error) {
    console.error('❌ [Tutor] Erro ao atualizar perfil:', error)
    return serverError({ message: 'Erro ao atualizar perfil' })
  }
})
