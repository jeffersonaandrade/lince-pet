import { ApiRequest, ok, route, unauthorized } from '@/server/http'
import { cronAutorizado } from '@/server/services/whatsapp-lembretes'
import { conciliarCancelamentos } from '@/server/services/asaas-cancelamentos'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export const GET = route(async req => {
  const request = await ApiRequest.from(req)
  if (!cronAutorizado(request.header('authorization'))) return unauthorized({ message: 'Não autorizado' })
  return ok(await conciliarCancelamentos())
})
