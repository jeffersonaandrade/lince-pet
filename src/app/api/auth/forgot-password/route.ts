import { ApiRequest, badRequest, ok, route, serverError } from '@/server/http'
import { forgotPassword } from '@/server/services/auth'

export const POST = route(async (req) => {
  const email = (await ApiRequest.from(req)).input('email')
  if (!email) return badRequest({ message: 'E-mail é obrigatório.' })

  try {
    return ok(await forgotPassword(String(email)))
  } catch (error) {
    console.error(error)
    return serverError({ message: 'Erro interno ao tentar enviar e-mail.' })
  }
})
