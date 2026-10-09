import { ApiRequest, json, route } from '@/server/http'
import { registerTutor } from '@/server/services/tutor'
import { createTutorValidator } from '@/server/validators/tutor'

export const POST = route(async (req) => {
  try {
    const request = await ApiRequest.from(req)
    const payload = await createTutorValidator.validate(request.all())
    await registerTutor(payload)
    return json({ message: 'Tutor registrado com sucesso' }, 201)
  } catch (error) {
    console.log('Error:', error)
    throw error
  }
})
