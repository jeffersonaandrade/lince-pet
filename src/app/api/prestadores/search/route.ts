import { ApiRequest, ok, route } from '@/server/http'
import { buscarPrestadores } from '@/server/services/prestadores'

/** GET /prestadores/search?tipo=&cidade=&estado=&search= */
export const GET = route(async (req) => {
  const request = await ApiRequest.from(req)
  const [tipo, cidade, estado, search] = ['tipo', 'cidade', 'estado', 'search'].map((campo) => request.text(campo))
  const data = await buscarPrestadores({ tipo, cidade, estado, search })
  return ok({ data, total: data.length })
})
