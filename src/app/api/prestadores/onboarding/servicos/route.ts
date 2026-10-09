import { ApiRequest, ok, route } from '@/server/http'
import { requireUser } from '@/server/auth/session'
import { prestadorDoUsuario, salvarServicos } from '@/server/services/prestadores'

/** POST /prestadores/onboarding/servicos: substitui a lista de serviços e preços. */
export const POST = route(async (req) => {
  const apiReq = await ApiRequest.from(req)
  const user = await requireUser(apiReq, ['prestador'])
  await salvarServicos(await prestadorDoUsuario(user.id), apiReq.body, 2)
  return ok({ message: 'Serviços salvos' })
})
