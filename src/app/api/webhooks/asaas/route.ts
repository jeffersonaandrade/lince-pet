import { ApiRequest, ok, route, serverError, unauthorized } from '@/server/http'
import { handleAsaasEvent } from '@/server/services/asaas-webhook'

export const POST = route(async (req) => {
  try {
    const request = await ApiRequest.from(req)
    const token = request.header('asaas-access-token')
    const envToken = process.env.ASAAS_WEBHOOK_TOKEN

    if (envToken && token !== envToken) {
      console.warn(`[Webhook Asaas] Token inválido recebido.`)
      return unauthorized({ message: 'Token inválido' })
    }

    const payload = request.body
    console.log(`[Webhook Asaas] Recebido evento: ${payload?.event || ''}`, payload.payment?.id || payload.subscription?.id)

    await handleAsaasEvent(payload)
    return ok({ received: true })
  } catch (error) {
    console.error('[Webhook Asaas] Erro no processamento:', error)
    return serverError({ received: false, error: String(error) })
  }
})

export const GET = route(async () => ok({ ok: true }))
