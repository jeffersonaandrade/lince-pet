import { revalidatePath } from 'next/cache'
import { requireAdmin } from '@/server/auth/session'
import { ApiRequest, created, json, route } from '@/server/http'
import { criarPlanoSaudeAdmin, listarPlanosSaudeAdmin } from '@/server/services/admin-planos-saude'

export const GET = route(async req => {
  await requireAdmin(await ApiRequest.from(req))
  return json(await listarPlanosSaudeAdmin(), 200, { headers: { 'Cache-Control': 'private, no-store' } })
})

export const POST = route(async req => {
  const request = await ApiRequest.from(req)
  await requireAdmin(request)
  const result = await criarPlanoSaudeAdmin(request.body)
  revalidatePath('/servicos')
  return created(result)
})
