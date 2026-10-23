import { ApiRequest, ok, route } from '@/server/http'
import { buscarExames } from '@/server/services/exames'

/** GET /exames?search=&cidade=: aba Exames do explorar (público). */
export const GET = route(async (req) => {
  const request = await ApiRequest.from(req)
  return ok({ clinicas: await buscarExames({ search: request.text('search'), cidade: request.text('cidade') }) })
})
