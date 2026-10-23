import { ApiRequest, badRequest, noContent, route, texto } from '@/server/http'
import { requireUser } from '@/server/auth/session'
import { inscricaoValida, removerInscricao, salvarInscricao } from '@/server/services/push'

/** POST /push/inscricao { endpoint, keys: { p256dh, auth } }: cadastra este aparelho. */
export const POST = route(async (req) => {
  const request = await ApiRequest.from(req)
  const user = await requireUser(request)
  const inscricao = { endpoint: request.input('endpoint'), keys: request.input('keys') }
  if (!inscricaoValida(inscricao)) return badRequest({ message: 'Inscrição de notificação inválida.' })
  await salvarInscricao(user.id, inscricao, request.header('user-agent'))
  return noContent()
})

/** DELETE /push/inscricao { endpoint }: remove este aparelho. */
export const DELETE = route(async (req) => {
  const request = await ApiRequest.from(req)
  const user = await requireUser(request)
  const endpoint = texto(request.input('endpoint'))
  if (!endpoint) return badRequest({ message: 'Informe o endpoint.' })
  await removerInscricao(user.id, endpoint)
  return noContent()
})
