import { prisma } from '@/server/db'
import { ApiRequest, HttpError, badRequest, ok, route, serverError, unauthorized } from '@/server/http'
import { requireUser } from '@/server/auth/session'
import { confirmarUpload, uploadClinicaPhoto } from '@/server/services/storage'
import { updating } from '@/server/lucid'

export const POST = route(async (req) => {
  const request = await ApiRequest.from(req)
  const currentUser = await requireUser(request)

  try {
    const clinica = currentUser.clinica
    if (!clinica) {
      return unauthorized({ message: 'Usuário não autenticado ou não é clínica' })
    }

    const uploadedFile = request.file('profile_pic', {
      size: '5mb',
      extnames: ['jpg', 'jpeg', 'png', 'webp'],
    })

    if (!uploadedFile) {
      return badRequest({ message: 'Arquivo não enviado' })
    }

    if (!uploadedFile.isValid) {
      return badRequest({ message: 'Arquivo inválido', errors: uploadedFile.errors })
    }

    const result = await uploadClinicaPhoto(clinica.id, {
      buffer: await uploadedFile.buffer(),
      originalname: uploadedFile.clientName || 'clinica.jpg',
      mimetype: uploadedFile.type || 'image/jpeg',
    })

    await confirmarUpload(
      result,
      () =>
        prisma.$transaction([
          prisma.clinica.update({ where: { id: clinica.id }, data: updating({ fotoPerfil: result.url }) }),
          prisma.user.update({ where: { id: currentUser.id }, data: updating({ profilePic: result.url }) }),
        ]),
      { anteriores: [clinica.fotoPerfil, currentUser.profilePic], emUso: [clinica.fotoCapa] }
    )

    return ok({ url: result.url, message: 'Foto de perfil atualizada com sucesso' })
  } catch (error) {
    if (error instanceof HttpError) throw error
    console.error('❌ [Clinica Upload] Erro:', error)
    return serverError({ message: 'Erro ao enviar foto' })
  }
})
