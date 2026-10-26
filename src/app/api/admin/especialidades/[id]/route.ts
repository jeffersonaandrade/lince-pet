import { revalidatePath } from 'next/cache'
import { requireAdmin } from '@/server/auth/session'
import { ApiRequest, ok, route } from '@/server/http'
import { atualizarEspecialidadeAdmin, inativarEspecialidadeAdmin } from '@/server/services/admin-especialidades'

export const PUT = route<{ id: string }>(async (req, { id }) => {
  const request = await ApiRequest.from(req)
  await requireAdmin(request)
  const result = await atualizarEspecialidadeAdmin(id, request.body)
  revalidatePath('/servicos')
  return ok(result)
})

export const DELETE = route<{ id: string }>(async (req, { id }) => {
  const request = await ApiRequest.from(req)
  await requireAdmin(request)
  const result = await inativarEspecialidadeAdmin(id, request.body)
  revalidatePath('/servicos')
  return ok(result)
})
