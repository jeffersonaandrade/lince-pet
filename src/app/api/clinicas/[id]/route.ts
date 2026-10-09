import { prisma } from '@/server/db'
import { notFound, ok, route } from '@/server/http'
import {
  especialidadesPorEntidade,
  mediaAvaliacoes,
  serializeClinica,
  serializeEndereco,
  serializeRelatedUser,
} from '@/server/services/clinicas'

export const GET = route<{ id: string }>(async (_req, { id }) => {
  try {
    const clinica = await prisma.clinica.findFirst({
      where: { id },
      include: {
        user: true,
        clinicaPlanos: { include: { plano: true } },
        avaliacoes: { where: { estrelasClinica: { not: null } } },
        veterinarioClinicas: {
          where: { status: 'aceito' },
          include: {
            veterinario: {
              include: { user: true, avaliacoes: true, enderecos: { where: { clinicaId: id } } },
            },
          },
        },
      },
    })
    if (!clinica) throw new Error('Row not found')

    const { user, clinicaPlanos, avaliacoes, veterinarioClinicas, ...attrs } = clinica
    const vets = veterinarioClinicas.map((vc) => vc.veterinario)
    const [especialidadesClinica, especialidadesVets] = await Promise.all([
      especialidadesPorEntidade([clinica.id], 'clinica'),
      especialidadesPorEntidade(
        vets.map((v) => v.id),
        'veterinario'
      ),
    ])

    const veterinarios = vets.map(({ user: vetUser, avaliacoes: vetAvaliacoes, enderecos, ...vet }) => ({
      ...vet,
      user: serializeRelatedUser(vetUser),
      especialidades: especialidadesVets.get(vet.id) ?? [],
      avaliacoes: vetAvaliacoes,
      enderecos: enderecos.map(serializeEndereco),
      ...mediaAvaliacoes(vetAvaliacoes.map((a) => a.estrelas)),
    }))

    const { rating, totalReviews } = mediaAvaliacoes(avaliacoes.map((a) => a.estrelasClinica))

    return ok({
      ...serializeClinica(attrs),
      user: serializeRelatedUser(user),
      especialidades: especialidadesClinica.get(clinica.id) ?? [],
      planos: clinicaPlanos.map((cp) => cp.plano),
      avaliacoes,
      veterinarios,
      rating: rating || 0.0,
      totalReviews,
    })
  } catch (error) {
    console.error(error)
    return notFound({ message: 'Clínica não encontrada' })
  }
})
