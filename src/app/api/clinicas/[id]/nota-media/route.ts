import { prisma } from '@/server/db'
import { ok, route, serverError } from '@/server/http'
import { media } from '@/server/services/avaliacoes'

export const GET = route<{ id: string }>(async (_req, { id }) => {
  try {
    const rows = await prisma.avaliacao.findMany({
      where: { clinicaId: id, estrelasClinica: { not: null } },
      select: { estrelasClinica: true },
    })
    return ok({ media: media(rows.map((r) => r.estrelasClinica)), total: rows.length })
  } catch (error) {
    console.error('Erro ao calcular média de clínica:', error)
    return serverError({ message: 'Erro interno ao calcular média' })
  }
})
