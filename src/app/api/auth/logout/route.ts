import { ok, route } from '@/server/http'
import { clearAuthCookie } from '@/server/auth/session'

export const POST = route(async () => {
  const res = ok({ message: 'Logout realizado com sucesso' })
  clearAuthCookie(res)
  return res
})
