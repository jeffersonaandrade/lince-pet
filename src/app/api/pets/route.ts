import { prisma } from '@/server/db'
import { ApiRequest, created, ok, route } from '@/server/http'
import { requireUser } from '@/server/auth/session'
import { creating } from '@/server/lucid'
import { requireTutorOf } from '@/server/services/pets'
import { createPetValidator } from '@/server/validators/pet'

export const GET = route(async (req) => {
  const user = await requireUser(await ApiRequest.from(req), ['tutor'])
  const tutor = await requireTutorOf(user.id)
  const pets = await prisma.pet.findMany({ where: { tutorId: tutor.id }, orderBy: { createdAt: 'desc' } })
  return ok({ pets })
})

export const POST = route(async (req) => {
  const request = await ApiRequest.from(req)
  const user = await requireUser(request, ['tutor'])
  const tutor = await requireTutorOf(user.id)
  const payload = await createPetValidator.validate(request.all())

  const pet = await prisma.pet.create({
    data: creating({
      tutorId: tutor.id,
      nome: payload.nome,
      especie: payload.especie,
      raca: payload.raca ?? null,
      idade: payload.idade ?? null,
      porte: payload.porte ?? null,
      fotoUrl: payload.foto_url ?? null,
    }),
  })
  return created({ message: 'Pet criado com sucesso', pet })
})
