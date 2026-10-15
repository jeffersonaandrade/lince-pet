import { ApiRequest, ok, route, serverError, unauthorized } from '@/server/http'
import { handleAsaasEvent, lerEventoAsaas } from '@/server/services/asaas-webhook'
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

    const evento = lerEventoAsaas(request.body)
    console.log(`[Webhook Asaas] Recebido evento: ${evento.event || ''}`, evento.payment?.id || evento.subscription?.id)

    await handleAsaasEvent(request.body)
    return ok({ received: true })
  } catch (error) {
    console.error('[Webhook Asaas] Erro no processamento:', error)
    return serverError({ received: false, error: String(error) })
  }
})

export const GET = route(async () => ok({ ok: true }))
