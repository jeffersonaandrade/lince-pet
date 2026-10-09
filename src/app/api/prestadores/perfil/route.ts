import { ApiRequest, ok, route } from '@/server/http'
import { requireUser } from '@/server/auth/session'
import { perfilDoPrestador, prestadorDoUsuario } from '@/server/services/prestadores'

/** GET /prestadores/perfil: dados do próprio prestador (onboarding e painel). */
export const GET = route(async (req) => {
  const user = await requireUser(await ApiRequest.from(req), ['prestador'])
  const prestador = await prestadorDoUsuario(user.id)
  return ok({ data: await perfilDoPrestador(prestador) })
})
