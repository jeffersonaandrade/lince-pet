import { ok, route, serverError } from '@/server/http'
import { listarAvaliacoes, media, serializarVeterinario } from '@/server/services/avaliacoes'

export const GET = route<{ id: string }>(async (_req, { id }) => {
  try {
    const avaliacoes = await listarAvaliacoes({ veterinarioId: id })
    return ok({
      media: media(avaliacoes.map((a) => a.estrelas)),
      total: avaliacoes.length,
      avaliacoes: avaliacoes.map((a) => serializarVeterinario(a)),
    })
  } catch (error) {
    console.error('Erro ao listar avaliações:', error)
    return serverError({ message: 'Erro interno ao listar avaliações' })
  }
})
