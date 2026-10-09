import { ok, route } from '@/server/http'
import { listarTiposServico, serializeTipoServico } from '@/server/services/prestadores'

/** GET /tipos-servico: catálogo público dos tipos de profissional pet. */
export const GET = route(async () => {
  const tipos = await listarTiposServico()
  return ok({ data: tipos.map(serializeTipoServico) })
})
