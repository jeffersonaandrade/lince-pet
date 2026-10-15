import { ApiRequest, created, json, route } from '@/server/http'
import { requireUser } from '@/server/auth/session'
import { prisma } from '@/server/db'
import { updating } from '@/server/lucid'
import { confirmarUpload, uploadVeterinarioPhoto } from '@/server/services/storage'
import {
  registerVeterinario,
  serializeVeterinario,
  type VeterinarioRegistrationData,
} from '@/server/services/veterinarios'
import { listarEquipe } from '@/server/services/clinica-equipe'
import { createVeterinarioRegistrationValidator } from '@/server/validators/veterinario'

export const POST = route(async (req) => {
  const apiReq = await ApiRequest.from(req)
  const uploadedFile = apiReq.file('profile_pic', { size: '5mb' })

  const payload: VeterinarioRegistrationData = await createVeterinarioRegistrationValidator.validate(apiReq.all())
  const veterinarioId = await registerVeterinario(payload)

  if (uploadedFile?.isValid) {
    try {
      const result = await uploadVeterinarioPhoto(veterinarioId, {
        buffer: await uploadedFile.buffer(),
        originalname: uploadedFile.clientName || 'photo.jpg',
        mimetype: uploadedFile.type || 'image/jpeg',
      })
      await confirmarUpload(result, () =>
        prisma.veterinario.update({ where: { id: veterinarioId }, data: updating({ fotoUrl: result.url }) })
      )
    } catch (err) {
      console.error('[cadastro veterinario] foto não enviada:', err)
    }
  }

  return created({ message: 'Veterinário registrado com sucesso' })
})

export const GET = route(async (req) => {
  const currentUser = await requireUser(await ApiRequest.from(req), ['clinica'])
  if (!currentUser.clinica) return json({ veterinarios: [] })
  const equipe = await listarEquipe(currentUser.clinica.id)
  return json({ veterinarios: equipe.map(serializeVeterinario) })
})
