import { prisma } from '@/server/db'
import { ApiRequest, badRequest, notFound, ok, route, serverError } from '@/server/http'
import { updating } from '@/server/lucid'
import { requireUser } from '@/server/auth/session'
import { uploadVeterinarioPhoto } from '@/server/services/storage'
import {
  PHOTO_OPTIONS,
  findVeterinarioByUser,
  pickPhoto,
} from '@/server/services/veterinario-dashboard'

export const POST = route(async (req) => {
  const apiReq = await ApiRequest.from(req)
  const user = await requireUser(apiReq, ['veterinario'])
  try {
    if (!(apiReq.header('content-type') || '').includes('multipart/form-data')) {
      return badRequest({ message: 'Conteúdo inválido. Envie multipart/form-data.' })
    }

    const uploadedFile = pickPhoto((name) => apiReq.file(name, PHOTO_OPTIONS))
    if (!uploadedFile) {
      return badRequest({
        message:
          "Arquivo não enviado. Envie um campo de arquivo com a chave 'profile_pic' (ou 'file', 'image', 'photo', 'avatar')",
      })
    }
    if (!uploadedFile.isValid) {
      return badRequest({ message: 'Arquivo inválido', errors: uploadedFile.errors })
    }

    const veterinario = await findVeterinarioByUser(user.id)
    if (!veterinario) return notFound({ message: 'Veterinário não encontrado' })

    const result = await uploadVeterinarioPhoto({
      buffer: await uploadedFile.buffer(),
      originalname: uploadedFile.clientName || 'photo.jpg',
      mimetype: uploadedFile.type || 'image/jpeg',
    })

    await prisma.veterinario.update({
      where: { id: veterinario.id },
      data: updating({ fotoUrl: result.url }),
    })

    return ok({ message: 'Foto de perfil atualizada com sucesso', url: result.url })
  } catch (error) {
    console.error('❌ [Upload Foto] Erro ao enviar foto de perfil:', error)
    return serverError({ message: 'Erro ao enviar foto de perfil' })
  }
})
