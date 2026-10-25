import { ApiRequest, ok, route } from '@/server/http'
import { requireAdmin } from '@/server/auth/session'
import { listarRecuperacoes } from '@/server/services/recuperacao-cnpj'
export const GET = route(async req => {
  await requireAdmin(await ApiRequest.from(req))
  return ok({ pedidos: await listarRecuperacoes() })
})
