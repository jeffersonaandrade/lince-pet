import { revalidatePath } from 'next/cache'
import { requireAdmin } from '@/server/auth/session'
import { ApiRequest, ok, route } from '@/server/http'
import { atualizarPlanoSaudeAdmin, inativarPlanoSaudeAdmin } from '@/server/services/admin-planos-saude'

export const PUT = route<{ id: string }>(async (req, { id }) => {
  const request = await ApiRequest.from(req)
  await requireAdmin(request)
  const result = await atualizarPlanoSaudeAdmin(id, request.body)
  revalidatePath('/servicos')
  return ok(result)
})

export const DELETE = route<{ id: string }>(async (req, { id }) => {
  const request = await ApiRequest.from(req)
  await requireAdmin(request)
  const result = await inativarPlanoSaudeAdmin(id, request.body)
  revalidatePath('/servicos')
  return ok(result)
})
