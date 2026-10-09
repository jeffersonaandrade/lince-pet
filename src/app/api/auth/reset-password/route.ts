import { ApiRequest, badRequest, ok, route } from '@/server/http'
import { resetPassword } from '@/server/services/auth'

export const POST = route(async (req) => {
  const request = await ApiRequest.from(req)
  const token = request.input('token')
  const password = request.input('password')
  const passwordConfirmation = request.input('password_confirmation')

  if (!token || !password || !passwordConfirmation) {
    return badRequest({ message: 'Todos os campos são obrigatórios.' })
  }

  if (password !== passwordConfirmation) {
    return badRequest({ message: 'As senhas não coincidem.' })
  }

  try {
    return ok(await resetPassword(String(token), String(password)))
  } catch (error) {
    return badRequest({ message: (error as Error)?.message || 'Erro ao redefinir a senha.' })
  }
})
