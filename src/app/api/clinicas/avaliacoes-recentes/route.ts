import { prisma } from '@/server/db'
import { ApiRequest, badRequest, ok, route, serverError } from '@/server/http'
import { requireUser } from '@/server/auth/session'
import { listarAvaliacoes, serializarClinica } from '@/server/services/avaliacoes'

export const GET = route(async (req) => {
  const currentUser = await requireUser(await ApiRequest.from(req))
  try {
    const clinica = await prisma.clinica.findFirst({ where: { userId: currentUser.id } })
    if (!clinica) return badRequest({ message: 'Clínica não encontrada' })

    const avaliacoes = await listarAvaliacoes({ clinicaId: clinica.id }, { comPet: true, limit: 10 })
    return ok({ avaliacoes: avaliacoes.map((a) => serializarClinica(a, true)) })
  } catch (error) {
    console.error('Erro ao listar avaliações recentes da clínica:', error)
    return serverError({ message: 'Erro interno ao listar avaliações' })
  }
})
