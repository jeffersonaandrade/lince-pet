import { ApiRequest, created, json, route } from '@/server/http'
import { requireUser } from '@/server/auth/session'
import { uploadVeterinarioPhoto } from '@/server/services/storage'
import { registerVeterinario, type VeterinarioRegistrationData } from '@/server/services/veterinarios'
import { listVeterinarios } from '@/server/services/onboarding'
import { createVeterinarioRegistrationValidator } from '@/server/validators/veterinario'

export const POST = route(async (req) => {
  const apiReq = await ApiRequest.from(req)
  const uploadedFile = apiReq.file('profile_pic')

  const payload: VeterinarioRegistrationData = await createVeterinarioRegistrationValidator.validate(apiReq.all())
  if (uploadedFile) {
    try {
      const result = await uploadVeterinarioPhoto({
        buffer: await uploadedFile.buffer(),
        originalname: uploadedFile.clientName || 'photo.jpg',
        mimetype: uploadedFile.type || 'image/jpeg',
      })
      payload.profilePicUrl = result.url
    } catch (err) {
      console.error('[upload-debug] upload error:', err)
    }
  }

  await registerVeterinario(payload)

  return created({ message: 'Veterinário registrado com sucesso' })
})

export const GET = route(async (req) => {
  const currentUser = await requireUser(await ApiRequest.from(req), ['clinica'])
  const veterinarios = await listVeterinarios(currentUser)
  return json({ veterinarios })
})
