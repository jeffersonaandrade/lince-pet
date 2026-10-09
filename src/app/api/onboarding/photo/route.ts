import { ApiRequest, badRequest, notFound, ok, route, serverError } from '@/server/http'
import { requireUser } from '@/server/auth/session'
import { prisma } from '@/server/db'
import { updating } from '@/server/lucid'
import { uploadVeterinarioPhoto } from '@/server/services/storage'
import { findVeterinarioByUser } from '@/server/services/veterinarios'

const OPTIONS = { size: '5mb', extnames: ['jpg', 'jpeg', 'png', 'webp', 'gif'] }

export const POST = route(async (req) => {
  const apiReq = await ApiRequest.from(req)
  const currentUser = await requireUser(apiReq, ['veterinario'])
  try {
    if (!(apiReq.header('content-type') || '').includes('multipart/form-data')) {
      return badRequest({ message: 'Conteúdo inválido. Envie multipart/form-data.' })
    }

    const uploadedFile =
      apiReq.file('profile_pic', OPTIONS) ||
      apiReq.file('file', OPTIONS) ||
      apiReq.file('image', OPTIONS) ||
      apiReq.file('photo', OPTIONS) ||
      apiReq.file('avatar', OPTIONS)

    if (!uploadedFile) {
      return badRequest({
        message:
          "Arquivo não enviado. Envie um campo de arquivo com a chave 'profile_pic' (ou 'file', 'image', 'photo', 'avatar')",
      })
    }

    if (!uploadedFile.isValid) {
      return badRequest({ message: 'Arquivo inválido', errors: uploadedFile.errors })
    }

    const veterinario = await findVeterinarioByUser(currentUser.id)
    if (!veterinario) {
      return notFound({ message: 'Veterinário não encontrado' })
    }

    const result = await uploadVeterinarioPhoto({
      buffer: await uploadedFile.buffer(),
      originalname: uploadedFile.clientName || 'photo.jpg',
      mimetype: uploadedFile.type || 'image/jpeg',
    })

    if (veterinario.fotoUrl !== result.url) {
      await prisma.veterinario.update({ where: { id: veterinario.id }, data: updating({ fotoUrl: result.url }) })
    }
    if (currentUser.profilePic !== result.url) {
      await prisma.user.update({ where: { id: currentUser.id }, data: updating({ profilePic: result.url }) })
    }

    return ok({
      message: 'Foto adicionada ao perfil com sucesso',
      url: result.url,
    })
  } catch (error) {
    console.error('❌ [Onboarding Foto] Erro ao enviar foto:', error)
    return serverError({ message: 'Erro ao enviar foto' })
  }
})
