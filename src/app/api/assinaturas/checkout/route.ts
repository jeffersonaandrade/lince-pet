import { ApiRequest, ok, route } from '@/server/http'
import { requireUser } from '@/server/auth/session'
import { AsaasService } from '@/server/services/asaas'
import { prepararCheckout } from '@/server/services/assinaturas-checkout'

/** Configura retorno de faturas novas ou já existentes, sem criar outra cobrança. */
export const POST = route(async req => {
  const user = await requireUser(await ApiRequest.from(req), ['veterinario', 'clinica', 'prestador'])
  return ok(await prepararCheckout(user, () => new AsaasService()))
})
