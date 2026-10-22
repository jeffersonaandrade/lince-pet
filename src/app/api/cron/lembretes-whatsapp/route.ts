import { ApiRequest, ok, route, unauthorized } from '@/server/http'
import { conciliarEnvios } from '@/server/services/whatsapp-fila'
import { cronAutorizado, processarLembretes } from '@/server/services/whatsapp-lembretes'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/** GET /cron/lembretes-whatsapp (Authorization: Bearer CRON_SECRET): lembretes + conciliação da fila de envios. */
export const GET = route(async (req) => {
  const apiReq = await ApiRequest.from(req)
  if (!cronAutorizado(apiReq.header('authorization'))) {
    return unauthorized({ message: 'Não autorizado' })
  }
  const lembretes = await processarLembretes()
  return ok({ ...lembretes, conciliacao: await conciliarEnvios() })
})
