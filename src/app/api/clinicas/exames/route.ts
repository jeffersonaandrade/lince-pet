import { requireClinica } from '@/server/auth/session'
import { ApiRequest, ok, route } from '@/server/http'
import { alternarModulo, catalogoDaClinica } from '@/server/services/exames'

/** GET /clinicas/exames: painel de exames da clínica (módulo, plano, RT, catálogo, uso do mês). */
export const GET = route(async (req) => {
  const clinica = await requireClinica(await ApiRequest.from(req))
  return ok(await catalogoDaClinica(clinica.id))
})

/** PATCH /clinicas/exames { ativo }: liga ou desliga o módulo. */
export const PATCH = route(async (req) => {
  const request = await ApiRequest.from(req)
  const clinica = await requireClinica(request)
  return ok(await alternarModulo(clinica.id, (request.body as { ativo?: unknown } | null)?.ativo))
})
