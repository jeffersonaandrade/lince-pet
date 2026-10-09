import { ApiRequest, HttpError, json, ok, route } from '@/server/http'
import { clearAuthCookie, requireUser } from '@/server/auth/session'
import { getUserProfile } from '@/server/services/auth'

export const GET = route(async (req) => {
  try {
    const user = await requireUser(await ApiRequest.from(req))
    return ok({ message: 'Dados do usuário', user: getUserProfile(user) })
  } catch (error) {
    if (error instanceof HttpError && error.status === 401 && error.message !== 'Token de autenticação não encontrado') {
      const res = json(error.body, 401)
      clearAuthCookie(res)
      return res
    }
    throw error
  }
})
