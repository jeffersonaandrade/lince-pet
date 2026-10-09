import { prisma } from '@/server/db'
import { ApiRequest, badRequest, ok, route } from '@/server/http'
import { requireUser } from '@/server/auth/session'
import { updating } from '@/server/lucid'
import { uploadPetPhoto } from '@/server/services/storage'
import { firstFile, isMultipart, requireTutorOf, requireTutorPet, toPhotoUpload } from '@/server/services/pets'

export const POST = route<{ id: string }>(async (req, { id }) => {
  const request = await ApiRequest.from(req)
  const user = await requireUser(request, ['tutor'])
  const tutor = await requireTutorOf(user.id)
  const pet = await requireTutorPet(tutor.id, id)

  if (!isMultipart(request)) {
    return badRequest({ message: 'Conteúdo inválido. Envie multipart/form-data.' })
  }

  const uploadedFile = firstFile(request, ['photo', 'image', 'file', 'avatar', 'profile_pic'])
  if (!uploadedFile) {
    return badRequest({
      message: "Arquivo não enviado. Use a chave 'photo' (ou 'image','file','avatar','profile_pic').",
    })
  }
  if (!uploadedFile.isValid) {
    return badRequest({ message: 'Arquivo inválido', errors: uploadedFile.errors })
  }

  const result = await uploadPetPhoto(await toPhotoUpload(uploadedFile))
  await prisma.pet.update({ where: { id: pet.id }, data: updating({ fotoUrl: result.url }) })

  return ok({ message: 'Foto do pet atualizada com sucesso', url: result.url })
})
