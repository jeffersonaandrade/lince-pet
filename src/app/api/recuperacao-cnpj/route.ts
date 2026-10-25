import { ApiRequest, ok, route } from '@/server/http'
import { limitarTentativas, LIMITES } from '@/server/rate-limit'
import { solicitarRecuperacao } from '@/server/services/recuperacao-cnpj'
export const POST = route(async req => {
  limitarTentativas(req, LIMITES.cadastro)
  return ok(await solicitarRecuperacao((await ApiRequest.from(req)).all()))
})
