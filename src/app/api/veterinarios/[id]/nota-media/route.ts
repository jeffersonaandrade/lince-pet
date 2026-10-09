import { prisma } from '@/server/db'
import { ok, route, serverError } from '@/server/http'
import { media } from '@/server/services/avaliacoes'

export const GET = route<{ id: string }>(async (_req, { id }) => {
  try {
    const rows = await prisma.avaliacao.findMany({ where: { veterinarioId: id }, select: { estrelas: true } })
    return ok({ media: media(rows.map((r) => r.estrelas)), total: rows.length })
  } catch (error) {
    console.error('Erro ao calcular média:', error)
    return serverError({ message: 'Erro interno ao calcular média' })
  }
})
