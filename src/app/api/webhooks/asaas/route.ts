import { ApiRequest, ok, route, serverError, unauthorized } from '@/server/http'
import { isProduction } from '@/server/env'
import { handleAsaasEvent, lerEventoAsaas } from '@/server/services/asaas-webhook'
import { webhookAutorizado } from '@/server/services/assinatura-regras'
import { after } from 'next/server'
import { conciliarCancelamentos } from '@/server/services/asaas-cancelamentos'
import { respostaDoAsaas } from '@/server/services/asaas'

export const POST = route(async (req) => {
  try {
    const request = await ApiRequest.from(req)
    const envToken = process.env.ASAAS_WEBHOOK_TOKEN
    if (!webhookAutorizado(envToken, request.header('asaas-access-token'), process.env.ASAAS_ENV, isProduction)) {
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
    after(async () => {
      try { await conciliarCancelamentos() }
      catch (error) { console.error('[Webhook Asaas] Conciliação adiada', respostaDoAsaas(error)) }
    })
    return ok({ received: true })
  } catch (error) {
    console.error('[Webhook Asaas] Erro no processamento:', respostaDoAsaas(error))
    return serverError({ received: false })
  }
})

export const GET = route(async () => ok({ ok: true }))
