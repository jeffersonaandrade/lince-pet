import { ApiRequest, forbidden, ok, route } from '@/server/http'
import { requireUser } from '@/server/auth/session'
import { AsaasService } from '@/server/services/asaas'
import { assinanteDe } from '@/server/services/assinante'
import { cancelarAssinaturas } from '@/server/services/assinaturas'

export const DELETE = route<{ id: string }>(async (req) => {
  const user = await requireUser(await ApiRequest.from(req), ['veterinario', 'clinica', 'prestador'])
  const assinante = assinanteDe(user)
  if (!assinante) return forbidden({ message: 'Apenas veterinários, clínicas e profissionais podem cancelar assinaturas' })
  await cancelarAssinaturas(assinante, () => new AsaasService())
  return ok({ message: 'Assinatura cancelada com sucesso' })
})
