import { prisma } from '@/server/db'
import { ApiRequest, badRequest, notFound, ok, route } from '@/server/http'
import { requireUser } from '@/server/auth/session'

export const GET = route(async (req) => {
  const request = await ApiRequest.from(req)
  const user = await requireUser(request, ['tutor'])
  const tutor = await prisma.tutor.findFirst({ where: { userId: user.id } })
  if (!tutor) return notFound({ message: 'Tutor not found' })

  const { veterinarioId, clinicaId } = request.qs()
  if (!veterinarioId && !clinicaId) {
    return badRequest({ message: 'Provide veterinarioId or clinicaId' })
  }

  const favorite = await prisma.favorite.findFirst({
    where: {
      tutorId: tutor.id,
      ...(veterinarioId ? { veterinarioId } : {}),
      ...(clinicaId ? { clinicaId } : {}),
    },
  })
  return ok({ isFavorited: !!favorite, favoriteId: favorite?.id })
})
