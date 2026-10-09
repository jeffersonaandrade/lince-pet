import { ApiRequest, created, route } from '@/server/http'
import { requireUser } from '@/server/auth/session'
import { AsaasService } from '@/server/services/asaas'
import { contratarPlano } from '@/server/services/assinaturas'

export const POST = route(async (req) => {
  const request = await ApiRequest.from(req)
  const user = await requireUser(request, ['veterinario', 'clinica', 'prestador'])
  const { planCode } = request.only(['planCode'])
  return created(await contratarPlano(user, planCode, () => new AsaasService()))
})
