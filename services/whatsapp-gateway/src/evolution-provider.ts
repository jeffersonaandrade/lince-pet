import { config } from './config.js'
import type { ProviderStatus, SendMessageInput, SendMessageResult, WhatsAppProvider } from './provider.js'

const withTimeout = async <T>(promise: Promise<T>, ms: number): Promise<T> => {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), ms)
  try {
    return await promise
  } finally {
    clearTimeout(timeout)
  }
}

async function requestJson(path: string, init: RequestInit = {}) {
  const url = `${config.evolution.baseUrl}${path}`
  const headers = {
    apikey: config.evolution.apiKey,
    'Content-Type': 'application/json',
    ...(init.headers || {}),
  }
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), config.sendTimeoutMs)
  try {
    const response = await fetch(url, { ...init, headers, signal: controller.signal })
    const text = await response.text()
    const body = text ? JSON.parse(text) : null
    if (!response.ok) {
      const error = new Error(`Evolution API returned ${response.status}`)
      Object.assign(error, { status: response.status, body })
      throw error
    }
    return body
  } finally {
    clearTimeout(timeout)
  }
}

const digitsOnly = (value: string) => value.replace(/\D/g, '')

export class EvolutionProvider implements WhatsAppProvider {
  name = 'evolution'

  async sendMessage(input: SendMessageInput): Promise<SendMessageResult> {
    const number = digitsOnly(input.to)
    if (number.length < 10 || number.length > 15) throw new Error('Invalid WhatsApp destination number')

    const body = await requestJson(`/message/sendText/${encodeURIComponent(config.evolution.instanceName)}`, {
      method: 'POST',
      body: JSON.stringify({
        number,
        text: input.text,
        delay: 1200,
      }),
    })

    return {
      providerMessageId: body?.key?.id || body?.messageId || undefined,
      raw: body,
    }
  }

  async status(): Promise<ProviderStatus> {
    try {
      const body = await withTimeout(
        requestJson(`/instance/connectionState/${encodeURIComponent(config.evolution.instanceName)}`),
        config.sendTimeoutMs
      )
      const state = String(body?.instance?.state || body?.state || 'unknown')
      return { ok: ['open', 'connected'].includes(state), state, details: body }
    } catch (error) {
      return { ok: false, state: 'error', details: error instanceof Error ? error.message : error }
    }
  }
}
