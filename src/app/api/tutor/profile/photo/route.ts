import { prisma } from '@/server/db'
import { ApiRequest, badRequest, notFound, ok, route, serverError } from '@/server/http'
import { requireUser } from '@/server/auth/session'
import { updating } from '@/server/lucid'
import { uploadTutorPhoto } from '@/server/services/storage'
import { firstFile, isMultipart, toPhotoUpload } from '@/server/services/pets'

export const POST = route(async (req) => {
  const request = await ApiRequest.from(req)
  const user = await requireUser(request, ['tutor'])
  try {
    if (!isMultipart(request)) {
      return badRequest({ message: 'Conteúdo inválido. Envie multipart/form-data.' })
    }

    const uploadedFile = firstFile(request, ['profile_pic', 'file', 'image', 'photo', 'avatar'])
    if (!uploadedFile) {
      return badRequest({
        message:
          "Arquivo não enviado. Envie um campo de arquivo com a chave 'profile_pic' (ou 'file', 'image', 'photo', 'avatar')",
      })
    }
    if (!uploadedFile.isValid) {
      return badRequest({ message: 'Arquivo inválido', errors: uploadedFile.errors })
    }

    const result = await uploadTutorPhoto(await toPhotoUpload(uploadedFile))

    const dbUser = await prisma.user.findUnique({ where: { id: user.id } })
    if (!dbUser) return notFound({ message: 'Usuário não encontrado' })
    await prisma.user.update({ where: { id: dbUser.id }, data: updating({ profilePic: result.url }) })

    return ok({ message: 'Foto de perfil atualizada com sucesso', url: result.url })
  } catch (error) {
    console.error('❌ [Tutor] Erro ao enviar foto de perfil:', error)
    return serverError({ message: 'Erro ao enviar foto de perfil' })
  }
})
