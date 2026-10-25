import { ApiRequest, ok, route } from '@/server/http'
import { requireAdmin } from '@/server/auth/session'
import { exigirMesmaOrigem } from '@/server/auth/origin'
import { decidirRecuperacao } from '@/server/services/recuperacao-cnpj'
export const PATCH = route<{ id: string }>(async (req, { id }) => {
  exigirMesmaOrigem(req)
  const request = await ApiRequest.from(req)
  const admin = await requireAdmin(request)
  return ok(await decidirRecuperacao(id, admin.id, request.all()))
})
