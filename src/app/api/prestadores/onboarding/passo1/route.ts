import { ApiRequest, ok, route } from '@/server/http'
import { requireUser } from '@/server/auth/session'
import { prestadorDoUsuario, salvarPasso1 } from '@/server/services/prestadores'

/** POST /prestadores/onboarding/passo1: endereço e onde atende. Também usado na edição do perfil. */
export const POST = route(async (req) => {
  const apiReq = await ApiRequest.from(req)
  const user = await requireUser(apiReq, ['prestador'])
  await salvarPasso1(await prestadorDoUsuario(user.id), apiReq.body)
  return ok({ message: 'Endereço salvo' })
})
