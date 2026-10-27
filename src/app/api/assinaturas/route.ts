import { ApiRequest, created, route } from '@/server/http'
import { requireUser } from '@/server/auth/session'
import { AsaasService } from '@/server/services/asaas'
import { contratarPlano } from '@/server/services/assinaturas'

export const POST = route(async (req) => {
  const request = await ApiRequest.from(req)
  const user = await requireUser(request, ['veterinario', 'clinica', 'prestador'])
  const { planCode, valorConfirmadoCentavos, aceite } = request.only(['planCode', 'valorConfirmadoCentavos', 'aceite'])
  return created(await contratarPlano(user, planCode, () => new AsaasService(), { valorConfirmadoCentavos, aceite }))
})
