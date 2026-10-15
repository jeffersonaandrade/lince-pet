export type SendMessageInput = {
  to: string
  text: string
  idempotencyKey?: string
}

export type SendMessageResult = {
  providerMessageId?: string
  raw?: unknown
}

export type ProviderStatus = {
  ok: boolean
  state: string
  details?: unknown
}

export interface WhatsAppProvider {
  name: string
  sendMessage(input: SendMessageInput): Promise<SendMessageResult>
  status(): Promise<ProviderStatus>
}

export class LogProvider implements WhatsAppProvider {
  name = 'log'

  async sendMessage(input: SendMessageInput): Promise<SendMessageResult> {
    console.log(JSON.stringify({ level: 'info', event: 'whatsapp.log_send', to: input.to, textLength: input.text.length }))
    return { providerMessageId: `log-${Date.now()}` }
  }

  async status(): Promise<ProviderStatus> {
    return { ok: true, state: 'log_provider' }
  }
}
