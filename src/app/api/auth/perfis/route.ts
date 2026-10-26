import { ApiRequest, created, json, ok, route } from '@/server/http'
import { requireUser, setAuthCookie } from '@/server/auth/session'
import { exigirMesmaOrigem } from '@/server/auth/origin'
import { ativarPerfil, listarPerfis, selecionarPerfil } from '@/server/services/perfis'
import { getUserProfile } from '@/server/services/auth'

export const GET = route(async req => {
  const user = await requireUser(await ApiRequest.from(req))
  return json(await listarPerfis(user.id), 200, { headers: { 'Cache-Control': 'private, no-store' } })
})
export const POST = route(async req => {
  exigirMesmaOrigem(req)
  const request = await ApiRequest.from(req)
  const user = await requireUser(request)
  return created(await ativarPerfil(user.id, request.body))
})
export const PUT = route(async req => {
  exigirMesmaOrigem(req)
  const request = await ApiRequest.from(req)
  const atual = await requireUser(request)
  const { user, token } = await selecionarPerfil(atual.id, request.input('tipo'))
  const res = ok({ user: getUserProfile(user) })
  setAuthCookie(res, token)
  return res
})
