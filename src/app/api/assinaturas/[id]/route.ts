import { ApiRequest, forbidden, json, notFound, route } from '@/server/http'
import { prisma } from '@/server/db'
import { requireUser } from '@/server/auth/session'
import { AsaasService } from '@/server/services/asaas'
import { assinanteDe, assinaturasDo } from '@/server/services/assinante'
import { cancelarAssinaturas } from '@/server/services/assinaturas'

export const DELETE = route<{ id: string }>(async (req, { id }) => {
  const user = await requireUser(await ApiRequest.from(req), ['veterinario', 'clinica', 'prestador'])
  const assinante = assinanteDe(user)
  if (!assinante) return forbidden({ message: 'Apenas veterinários, clínicas e profissionais podem cancelar assinaturas' })
  const sub = await prisma.subscription.findFirst({ where: { id, ...assinaturasDo(assinante) }, select: { id: true } })
  if (!sub) return notFound({ message: 'Assinatura não encontrada' })
  const resultado = await cancelarAssinaturas(assinante, () => new AsaasService())
  return json(resultado, resultado.cancelamentoPendente ? 202 : 200)
})
