import { revalidatePath } from 'next/cache'
import { requireAdmin } from '@/server/auth/session'
import { ApiRequest, ok, route } from '@/server/http'
import { atualizarProfissaoAdmin, inativarProfissaoAdmin } from '@/server/services/admin-profissoes'

export const PUT = route<{ id: string }>(async (req, { id }) => {
  const request = await ApiRequest.from(req)
  const admin = await requireAdmin(request)
  const result = await atualizarProfissaoAdmin(id, request.body)
  console.info('[Admin.profissoes]', { adminId: admin.id, profissaoId: result.id, acao: req.method })
  revalidatePath('/servicos')
  return ok(result)
})

export const DELETE = route<{ id: string }>(async (req, { id }) => {
  const request = await ApiRequest.from(req)
  const admin = await requireAdmin(request)
  const result = await inativarProfissaoAdmin(id, request.body)
  console.info('[Admin.profissoes]', { adminId: admin.id, profissaoId: result.id, acao: req.method })
  revalidatePath('/servicos')
  return ok(result)
})
