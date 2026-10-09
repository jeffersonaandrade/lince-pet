import { ApiRequest, created, route } from '@/server/http'
import { registrarPrestador, registroValidator } from '@/server/services/prestadores'

/** POST /prestadores/register: cria a conta do profissional pet (onboarding em seguida). */
export const POST = route(async (req) => {
  const apiReq = await ApiRequest.from(req)
  const data = await registroValidator.validate(apiReq.all())
  await registrarPrestador(data)
  return created({ message: 'Profissional cadastrado com sucesso' })
})
