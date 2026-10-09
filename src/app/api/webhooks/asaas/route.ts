import { ApiRequest, ok, route, serverError, unauthorized } from '@/server/http'
import { handleAsaasEvent } from '@/server/services/asaas-webhook'
import { webhookAutorizado } from '@/server/services/assinatura-regras'

export const POST = route(async (req) => {
  try {
    const request = await ApiRequest.from(req)
    const envToken = process.env.ASAAS_WEBHOOK_TOKEN
    if (!webhookAutorizado(envToken, request.header('asaas-access-token'), process.env.ASAAS_ENV)) {
      console.warn(
        envToken
          ? '[Webhook Asaas] Token inválido recebido.'
          : '[Webhook Asaas] ASAAS_WEBHOOK_TOKEN não configurado em produção; evento recusado.'
      )
      return unauthorized({ message: 'Token inválido' })
    }

    const payload = request.body
    console.log(`[Webhook Asaas] Recebido evento: ${payload?.event || ''}`, payload?.payment?.id || payload?.subscription?.id)

    await handleAsaasEvent(payload)
    return ok({ received: true })
  } catch (error) {
    console.error('[Webhook Asaas] Erro no processamento:', error)
    return serverError({ received: false, error: String(error) })
  }
})

export const GET = route(async () => ok({ ok: true }))
