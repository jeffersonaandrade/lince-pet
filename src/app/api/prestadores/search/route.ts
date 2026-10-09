import { ApiRequest, ok, route } from '@/server/http'
import { buscarPrestadores } from '@/server/services/prestadores'

/** GET /prestadores/search?tipo=&cidade=&estado=&search= */
export const GET = route(async (req) => {
  const { tipo, cidade, estado, search } = (await ApiRequest.from(req)).qs()
  const data = await buscarPrestadores({ tipo, cidade, estado, search })
  return ok({ data, total: data.length })
})
