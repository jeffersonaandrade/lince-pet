import { ApiRequest, ok, route } from '@/server/http'
import { limitarTentativas, LIMITES } from '@/server/rate-limit'
import { confirmarEmailRecuperacao } from '@/server/services/recuperacao-cnpj'
export const POST = route(async req => {
  limitarTentativas(req, LIMITES.senha)
  return ok(await confirmarEmailRecuperacao((await ApiRequest.from(req)).input('token')))
})
