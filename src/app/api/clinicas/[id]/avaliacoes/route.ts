import { ok, route, serverError } from '@/server/http'
import { listarAvaliacoes, media, serializarClinica } from '@/server/services/avaliacoes'

export const GET = route<{ id: string }>(async (_req, { id }) => {
  try {
    const avaliacoes = await listarAvaliacoes({ clinicaId: id })
    return ok({
      media: media(avaliacoes.map((a) => a.estrelasClinica)),
      total: avaliacoes.length,
      avaliacoes: avaliacoes.map((a) => serializarClinica(a)),
    })
  } catch (error) {
    console.error('Erro ao listar avaliações de clínica:', error)
    return serverError({ message: 'Erro interno ao listar avaliações' })
  }
})
