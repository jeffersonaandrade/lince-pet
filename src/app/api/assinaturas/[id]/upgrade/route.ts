import { ApiRequest, ok, route } from '@/server/http'
import { requireUser } from '@/server/auth/session'
import { AsaasService } from '@/server/services/asaas'
import { trocarPlano } from '@/server/services/assinaturas'

export const PATCH = route<{ id: string }>(async (req, { id }) => {
  const request = await ApiRequest.from(req)
  const user = await requireUser(request, ['veterinario', 'clinica', 'prestador'])
  const { planCode } = request.only(['planCode'])
  return ok(await trocarPlano(user, id, planCode, () => new AsaasService()))
})
