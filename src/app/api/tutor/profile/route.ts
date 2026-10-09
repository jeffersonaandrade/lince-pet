import { prisma } from '@/server/db'
import { ApiRequest, notFound, ok, route, serverError } from '@/server/http'
import { requireUser } from '@/server/auth/session'
import { updating } from '@/server/lucid'

export const PUT = route(async (req) => {
  const request = await ApiRequest.from(req)
  const user = await requireUser(request, ['tutor'])
  try {
    const { nome } = request.only(['nome'])

    const dbUser = await prisma.user.findUnique({ where: { id: user.id } })
    if (!dbUser) return notFound({ message: 'Usuário não encontrado' })

    if (nome && String(nome) !== dbUser.nome) {
      await prisma.user.update({ where: { id: dbUser.id }, data: updating({ nome: String(nome) }) })
    }

    return ok({ message: 'Perfil atualizado com sucesso' })
  } catch (error) {
    console.error('❌ [Tutor] Erro ao atualizar perfil:', error)
    return serverError({ message: 'Erro ao atualizar perfil' })
  }
})
