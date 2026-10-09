import { prisma } from '@/server/db'
import { ApiRequest, badRequest, ok, route, serverError } from '@/server/http'
import { requireUser } from '@/server/auth/session'
import { listarAvaliacoes, serializarVeterinario } from '@/server/services/avaliacoes'

export const GET = route(async (req) => {
  const currentUser = await requireUser(await ApiRequest.from(req), ['veterinario'])
  try {
    const vet = await prisma.veterinario.findFirst({ where: { userId: currentUser.id } })
    if (!vet) return badRequest({ message: 'Veterinário não encontrado' })

    const avaliacoes = await listarAvaliacoes({ veterinarioId: vet.id }, { comPet: true, limit: 10 })
    return ok({ avaliacoes: avaliacoes.map((a) => serializarVeterinario(a, true)) })
  } catch (error) {
    console.error('Erro ao listar avaliações recentes do veterinário:', error)
    return serverError({ message: 'Erro interno ao listar avaliações' })
  }
})
