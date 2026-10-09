import { prisma } from '@/server/db'
import { ApiRequest, badRequest, conflict, created, notFound, ok, route } from '@/server/http'
import { requireUser } from '@/server/auth/session'
import { creating } from '@/server/lucid'

export const GET = route(async (req) => {
  const user = await requireUser(await ApiRequest.from(req), ['tutor'])
  const tutor = await prisma.tutor.findFirst({
    where: { userId: user.id },
    include: {
      favorites: {
        include: {
          veterinario: { include: { user: true, enderecos: true } },
          clinica: { include: { user: true } },
        },
      },
    },
  })
  if (!tutor) return notFound({ message: 'Tutor profile not found' })
  return ok(tutor.favorites)
})

export const POST = route(async (req) => {
  const request = await ApiRequest.from(req)
  const user = await requireUser(request, ['tutor'])
  const tutor = await prisma.tutor.findFirst({ where: { userId: user.id } })
  if (!tutor) return notFound({ message: 'Tutor profile not found' })

  const { veterinarioId, clinicaId } = request.only(['veterinarioId', 'clinicaId'])
  if (!veterinarioId && !clinicaId) {
    return badRequest({ message: 'You must provide either veterinarioId or clinicaId' })
  }

  const exists = await prisma.favorite.findFirst({
    where: { tutorId: tutor.id, ...(veterinarioId ? { veterinarioId } : { clinicaId }) },
  })
  if (exists) return conflict({ message: 'Already favorited' })

  const favorite = await prisma.favorite.create({
    data: creating({ tutorId: tutor.id, veterinarioId: veterinarioId || null, clinicaId: clinicaId || null }),
  })
  return created(favorite)
})
