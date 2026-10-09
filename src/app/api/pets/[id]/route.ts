import type { Pet } from '@prisma/client'
import { prisma } from '@/server/db'
import { ApiRequest, ok, route } from '@/server/http'
import { requireUser } from '@/server/auth/session'
import { updating } from '@/server/lucid'
import { requireTutorOf, requireTutorPet } from '@/server/services/pets'
import { updatePetValidator } from '@/server/validators/pet'

export const PATCH = route<{ id: string }>(async (req, { id }) => {
  const request = await ApiRequest.from(req)
  const user = await requireUser(request, ['tutor'])
  const tutor = await requireTutorOf(user.id)
  let pet = await requireTutorPet(tutor.id, id)

  const payload = await updatePetValidator.validate(request.all())
  const next: Partial<Pet> = {}
  if (payload.nome !== undefined) next.nome = payload.nome
  if (payload.especie !== undefined) next.especie = payload.especie
  if (payload.raca !== undefined) next.raca = payload.raca ?? null
  if (payload.idade !== undefined) next.idade = payload.idade ?? null
  if (payload.porte !== undefined) next.porte = payload.porte ?? null
  if (payload.foto_url !== undefined) next.fotoUrl = payload.foto_url ?? null

  // Lucid só executa UPDATE (e toca updatedAt) quando há campos alterados.
  const dirty = Object.fromEntries(
    Object.entries(next).filter(([key, value]) => pet[key as keyof Pet] !== value)
  ) as Partial<Pet>
  if (Object.keys(dirty).length) {
    pet = await prisma.pet.update({ where: { id: pet.id }, data: updating(dirty) })
  }

  return ok({ message: 'Pet atualizado com sucesso', pet })
})

export const DELETE = route<{ id: string }>(async (req, { id }) => {
  const user = await requireUser(await ApiRequest.from(req), ['tutor'])
  const tutor = await requireTutorOf(user.id)
  const pet = await requireTutorPet(tutor.id, id)
  await prisma.pet.delete({ where: { id: pet.id } })
  return ok({ message: 'Pet removido com sucesso' })
})
