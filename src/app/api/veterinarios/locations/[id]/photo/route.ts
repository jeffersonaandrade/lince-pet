import { ApiRequest, badRequest, notFound, ok, route, serverError } from '@/server/http'
import { requireUser } from '@/server/auth/session'
import { prisma } from '@/server/db'
import { updating } from '@/server/lucid'
import { uploadVeterinarioPhoto } from '@/server/services/storage'
import { findVeterinarioByUser } from '@/server/services/veterinarios'

export const POST = route<{ id: string }>(async (req, { id }) => {
  const apiReq = await ApiRequest.from(req)
  const currentUser = await requireUser(apiReq, ['veterinario'])
  try {
    const veterinario = await findVeterinarioByUser(currentUser.id)
    if (!veterinario) {
      return notFound({ message: 'Veterinário não encontrado' })
    }

    const endereco = await prisma.veterinarioEndereco.findFirst({
      where: { id, veterinarioId: veterinario.id },
    })
    if (!endereco) {
      return notFound({ message: 'Endereço não encontrado' })
    }

    const uploadedFile = apiReq.file('photo', {
      size: '5mb',
      extnames: ['jpg', 'jpeg', 'png', 'webp'],
    })

    if (!uploadedFile) {
      return badRequest({ message: 'Arquivo não enviado' })
    }

    if (!uploadedFile.isValid) {
      return badRequest({ message: 'Arquivo inválido', errors: uploadedFile.errors })
    }

    const result = await uploadVeterinarioPhoto({
      buffer: await uploadedFile.buffer(),
      originalname: uploadedFile.clientName || 'location.jpg',
      mimetype: uploadedFile.type || 'image/jpeg',
    })

    if (endereco.fotoUrl !== result.url) {
      await prisma.veterinarioEndereco.update({ where: { id: endereco.id }, data: updating({ fotoUrl: result.url }) })
    }

    return ok({ url: result.url, message: 'Foto do local enviada com sucesso' })
  } catch (error) {
    console.error('❌ [Upload Location Photo] Erro:', error)
    return serverError({ message: 'Erro ao enviar foto' })
  }
})
