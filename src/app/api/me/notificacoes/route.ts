import { ApiRequest, ok, route } from '@/server/http'
import { requireUser } from '@/server/auth/session'
import { canaisDe, salvarCanais, serializeCanais } from '@/server/services/canais-notificacao'

const paraBool = (v: unknown) => (v === undefined || v === null ? undefined : v === true || v === 1 || v === '1' || v === 'true')

/** GET /me/notificacoes: canais de aviso do usuÃ¡rio (google_agenda = conta conectada, sÃ³ leitura). */
export const GET = route(async (req) => {
  const user = await requireUser(await ApiRequest.from(req), ['tutor', 'veterinario', 'prestador'])
  return ok(serializeCanais(canaisDe(user)))
})

/** PUT /me/notificacoes { email?, whatsapp? } */
export const PUT = route(async (req) => {
  const request = await ApiRequest.from(req)
  const user = await requireUser(request, ['tutor', 'veterinario', 'prestador'])
  const { email, whatsapp } = request.only(['email', 'whatsapp'])
  const canais = await salvarCanais(user.id, { email: paraBool(email), whatsapp: paraBool(whatsapp) })
  return ok(serializeCanais(canais))
})
