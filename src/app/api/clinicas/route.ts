import type { Prisma } from '@prisma/client'
import { prisma } from '@/server/db'
import { ApiRequest, ok, route } from '@/server/http'
import {
  especialidadesPorEntidade,
  mediaAvaliacoes,
  serializeClinica,
  serializeRelatedUser,
} from '@/server/services/clinicas'

export const GET = route(async (req) => {
  const { search, cidade, estado, plano } = (await ApiRequest.from(req)).qs()
  const AND: Prisma.ClinicaWhereInput[] = []

  if (search) AND.push({ OR: [{ nomeClinica: { contains: search } }, { descricao: { contains: search } }] })
  if (cidade) AND.push({ cidade: { contains: cidade } })
  if (estado) AND.push({ estado })
  if (plano) {
    AND.push({ clinicaPlanos: { some: { plano: { name: { contains: plano, mode: 'insensitive' } } } } })
  }

  const clinicas = await prisma.clinica.findMany({
    where: { AND },
    include: {
      user: true,
      clinicaPlanos: { include: { plano: true } },
      avaliacoes: { where: { estrelasClinica: { not: null } } },
    },
  })
  const especialidades = await especialidadesPorEntidade(
    clinicas.map((c) => c.id),
    'clinica'
  )

  return ok(
    clinicas.map(({ user, clinicaPlanos, avaliacoes, ...clinica }) => {
      const { rating, totalReviews } = mediaAvaliacoes(avaliacoes.map((a) => a.estrelasClinica))
      return {
        ...serializeClinica(clinica),
        user: serializeRelatedUser(user),
        especialidades: especialidades.get(clinica.id) ?? [],
        planos: clinicaPlanos.map((cp) => cp.plano),
        avaliacoes,
        rating: rating || 0.0,
        totalReviews,
      }
    })
  )
})
