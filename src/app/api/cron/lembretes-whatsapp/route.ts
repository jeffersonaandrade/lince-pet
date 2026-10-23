import { ApiRequest, ok, route, unauthorized } from '@/server/http'
import { conciliarEnvios } from '@/server/services/whatsapp-fila'
import { cronAutorizado, processarLembretes } from '@/server/services/whatsapp-lembretes'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * GET /cron/lembretes-whatsapp (Authorization: Bearer CRON_SECRET): lembretes de consulta ao tutor (sino, navegador,
 * e-mail na véspera e WhatsApp) + conciliação da fila de envios. URL mantida pelo cron externo já configurado.
 */
export const GET = route(async (req) => {
  const apiReq = await ApiRequest.from(req)
  if (!cronAutorizado(apiReq.header('authorization'))) {
    return unauthorized({ message: 'Não autorizado' })
  }
  const lembretes = await processarLembretes()
  return ok({ ...lembretes, conciliacao: await conciliarEnvios() })
})
