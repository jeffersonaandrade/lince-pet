import { prisma } from '@/server/db'
import { ApiRequest, badRequest, conflict, created, notFound, ok, route } from '@/server/http'
import { requireUser } from '@/server/auth/session'
import { creating } from '@/server/lucid'

export const GET = route(async (req) => {
  const user = await requireUser(await ApiRequest.from(req), ['tutor'])
  const tutor = await prisma.tutor.findFirst({
    where: { userId: user.id },
    select: {
      favorites: {
        select: {
          id: true,
          tutorId: true,
          veterinarioId: true,
          clinicaId: true,
          createdAt: true,
          veterinario: {
            select: {
              id: true,
              fotoUrl: true,
              user: { select: { nome: true } },
              enderecos: { select: { cidade: true, estado: true } },
            },
          },
          clinica: {
            select: {
              id: true,
              nomeClinica: true,
              fotoPerfil: true,
              cidade: true,
              estado: true,
              user: { select: { nome: true } },
            },
          },
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

  const veterinarioId = request.text('veterinarioId')
  const clinicaId = request.text('clinicaId')
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
