import { ApiRequest, ok, route } from '@/server/http'
import { clearAuthCookie, extractToken, revogarSessao } from '@/server/auth/session'

export const POST = route(async (req) => {
  await revogarSessao(extractToken(await ApiRequest.from(req))).catch((error) => {
    console.error('[logout] falha ao revogar a sessão', error instanceof Error ? error.message : error)
  })
  const res = ok({ message: 'Logout realizado com sucesso' })
  clearAuthCookie(res)
  return res
})
