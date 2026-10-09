import { ok, route } from '@/server/http'
import { obterPrestadorPublico } from '@/server/services/prestadores'

/** GET /prestadores/:id: perfil público (sem CPF, e-mail nem celular). */
export const GET = route<{ id: string }>(async (_req, { id }) => {
  return ok({ data: await obterPrestadorPublico(id) })
})
