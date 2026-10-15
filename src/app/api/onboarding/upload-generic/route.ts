import { ApiRequest, HttpError, badRequest, notFound, ok, route, serverError } from '@/server/http'
import { requireUser } from '@/server/auth/session'
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
      apiReq.file('file', OPTIONS) ||
      apiReq.file('photo', OPTIONS) ||
      apiReq.file('image', OPTIONS) ||
      apiReq.file('profile_pic', OPTIONS)

    if (!uploadedFile) {
      return badRequest({ message: 'Arquivo não enviado' })
    }

    if (!uploadedFile.isValid) {
      return badRequest({ message: 'Arquivo inválido', errors: uploadedFile.errors })
    }

    const veterinario = await findVeterinarioByUser(currentUser.id)
    if (!veterinario) return notFound({ message: 'Veterinário não encontrado' })

    const result = await uploadVeterinarioPhoto(
      veterinario.id,
      {
        buffer: await uploadedFile.buffer(),
        originalname: uploadedFile.clientName || 'photo.jpg',
        mimetype: uploadedFile.type || 'image/jpeg',
      },
      ['uploads']
    )

    return ok({ url: result.url })
  } catch (error) {
    if (error instanceof HttpError) throw error
    console.error('❌ [Upload Generic] Erro:', error)
    return serverError({ message: 'Erro ao enviar foto' })
  }
})
