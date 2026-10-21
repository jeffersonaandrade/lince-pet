import { ApiRequest, created, route } from '@/server/http'
import { registrarPrestador, registroValidator } from '@/server/services/prestadores'
import { LIMITES, limitarTentativas } from '@/server/rate-limit'

/** POST /prestadores/register: cria a conta do profissional pet (onboarding em seguida). */
export const POST = route(async (req) => {
  limitarTentativas(req, LIMITES.cadastro)
  const apiReq = await ApiRequest.from(req)
  const data = await registroValidator.validate(apiReq.all())
  await registrarPrestador(data)
  return created({ message: 'Profissional cadastrado com sucesso' })
})
