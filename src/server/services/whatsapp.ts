import 'server-only'
import { randomUUID } from 'node:crypto'
import { env } from '../env'

/**
 * Envio de WhatsApp independente de provedor (número central da Lince Pet).
 * WHATSAPP_PROVIDER escolhe o driver; sem configuração usa `log`, que só registra.
 * Um provedor real (gateway, Z-API, UltraMsg...) é um novo driver registrado em `DRIVERS`.
 */
export interface WhatsAppProvider {
  nome: string
  enviar(to: string, texto: string): Promise<{ id?: string }>
}

/** Erro de envio; `temporario` habilita retry (rede, 429, 5xx). */
export class WhatsAppError extends Error {
  constructor(
    message: string,
    readonly temporario: boolean
  ) {
    super(message)
  }
}

const logProvider: WhatsAppProvider = {
  nome: 'log',
  async enviar(to, texto) {
    console.info(`[WhatsApp:log] para ${to}:\n${texto}`)
    return { id: `log-${randomUUID()}` }
  },
}

const gatewayProvider = (): WhatsAppProvider => ({
  nome: 'gateway',
  async enviar(to, texto) {
    const baseUrl = env('WHATSAPP_GATEWAY_URL')?.replace(/\/+$/, '')
    const token = env('WHATSAPP_GATEWAY_TOKEN')
    if (!baseUrl || !token) throw new WhatsAppError('WHATSAPP_GATEWAY_URL e WHATSAPP_GATEWAY_TOKEN são obrigatórios', false)

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 10_000)
    try {
      const response = await fetch(`${baseUrl}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Gateway-Token': token,
        },
        body: JSON.stringify({ to, text: texto }),
        signal: controller.signal,
      })
      const body = await response.json().catch(() => null)
      if (!response.ok) {
        throw new WhatsAppError(
          typeof body?.error === 'string' ? body.error : `Gateway retornou ${response.status}`,
          response.status === 429 || response.status >= 500
        )
      }
      return { id: typeof body?.id === 'string' ? body.id : undefined }
    } catch (error) {
      if ((error as { name?: string })?.name === 'AbortError') throw new WhatsAppError('Timeout ao chamar gateway', true)
      throw error
    } finally {
      clearTimeout(timeout)
    }
  },
})

const DRIVERS: Record<string, () => WhatsAppProvider> = {
  log: () => logProvider,
  gateway: gatewayProvider,
}

export function providerAtual(): WhatsAppProvider {
  const nome = (env('WHATSAPP_PROVIDER') || 'log').toLowerCase()
  const driver = DRIVERS[nome]
  if (!driver) {
    console.warn(`[WhatsApp] Provedor '${nome}' não implementado; usando 'log'.`)
    return logProvider
  }
  return driver()
}

/** 55 + DDD + número (sem '+'), a partir de celular BR com ou sem máscara/DDI; null se inválido. */
export function normalizarTelefoneE164(phone?: string | null): string | null {
  const digits = (phone || '').replace(/\D/g, '')
  if (digits.length === 10 || digits.length === 11) return `55${digits}`
  if ((digits.length === 12 || digits.length === 13) && digits.startsWith('55')) return digits
  return null
}

export function erroTemporario(error: unknown) {
  if (error instanceof WhatsAppError) return error.temporario
  const status = (error as { response?: { status?: number } })?.response?.status
  if (status) return status === 429 || status >= 500
  const code = (error as { code?: string })?.code
  return ['ECONNRESET', 'ETIMEDOUT', 'ECONNABORTED', 'ENOTFOUND', 'EAI_AGAIN'].includes(code || '')
}

const esperar = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

export const MAX_TENTATIVAS = 2

/** Até MAX_TENTATIVAS, repetindo só em erro temporário. */
export async function enviarComRetry(
  provider: WhatsAppProvider,
  to: string,
  texto: string,
  esperaMs = 1500
): Promise<{ ok: true; id?: string; tentativas: number } | { ok: false; erro: string; tentativas: number }> {
  let ultimoErro: unknown
  for (let tentativa = 1; tentativa <= MAX_TENTATIVAS; tentativa++) {
    try {
      const { id } = await provider.enviar(to, texto)
      return { ok: true, id, tentativas: tentativa }
    } catch (error) {
      ultimoErro = error
      if (!erroTemporario(error) || tentativa === MAX_TENTATIVAS) {
        return { ok: false, erro: mensagemDeErro(error), tentativas: tentativa }
      }
      await esperar(esperaMs * tentativa)
    }
  }
  return { ok: false, erro: mensagemDeErro(ultimoErro), tentativas: MAX_TENTATIVAS }
}

function mensagemDeErro(error: unknown) {
  const data = (error as { response?: { data?: unknown } })?.response?.data
  if (data) return typeof data === 'string' ? data : JSON.stringify(data)
  return error instanceof Error ? error.message : String(error)
}
