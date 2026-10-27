import { revalidatePath } from 'next/cache'
import { requireAdmin } from '@/server/auth/session'
import { ApiRequest, created, json, route } from '@/server/http'
import { criarProfissaoAdmin, listarProfissoesAdmin } from '@/server/services/admin-profissoes'

export const GET = route(async req => {
  await requireAdmin(await ApiRequest.from(req))
  return json(await listarProfissoesAdmin(), 200, { headers: { 'Cache-Control': 'private, no-store' } })
})

export const POST = route(async req => {
  const request = await ApiRequest.from(req)
  const admin = await requireAdmin(request)
  const result = await criarProfissaoAdmin(request.body)
  console.info('[Admin.profissoes]', { adminId: admin.id, profissaoId: result.id, acao: req.method })
  revalidatePath('/servicos')
  return created(result)
})
