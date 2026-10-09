import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  MAX_TENTATIVAS,
  WhatsAppError,
  enviarComRetry,
  erroTemporario,
  normalizarTelefoneE164,
  providerAtual,
  type WhatsAppProvider,
} from '@/server/services/whatsapp'

const fake = (enviar: WhatsAppProvider['enviar']): WhatsAppProvider => ({ nome: 'fake', enviar })

beforeEach(() => {
  vi.spyOn(console, 'info').mockImplementation(() => {})
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

describe('providerAtual (provedor agnóstico)', () => {
  it('sem WHATSAPP_PROVIDER usa o driver log, que só registra e gera id', async () => {
    vi.stubEnv('WHATSAPP_PROVIDER', '')
    const p = providerAtual()
    expect(p.nome).toBe('log')
    const r = await p.enviar('5581999990000', 'olá')
    expect(r.id).toMatch(/^log-/)
    expect(console.info).toHaveBeenCalledWith(expect.stringContaining('para 5581999990000'))
  })

  it('nome do provedor não diferencia maiúsculas', () => {
    vi.stubEnv('WHATSAPP_PROVIDER', 'LOG')
    expect(providerAtual().nome).toBe('log')
    expect(console.warn).not.toHaveBeenCalled()
  })

  it('provedor não implementado cai no log com aviso', () => {
    vi.stubEnv('WHATSAPP_PROVIDER', 'zapi')
    expect(providerAtual().nome).toBe('log')
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining("'zapi' não implementado"))
  })

  it('gateway envia para /messages com token e devolve o id local do job', async () => {
    vi.stubEnv('WHATSAPP_PROVIDER', 'gateway')
    vi.stubEnv('WHATSAPP_GATEWAY_URL', 'http://gateway.test/')
    vi.stubEnv('WHATSAPP_GATEWAY_TOKEN', 'secret')
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ id: 'job-1' }), { status: 202, headers: { 'Content-Type': 'application/json' } })
    )

    const r = await providerAtual().enviar('5581999990000', 'texto')

    expect(r).toEqual({ id: 'job-1' })
    expect(fetchMock).toHaveBeenCalledWith(
      'http://gateway.test/messages',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Gateway-Token': 'secret' },
        body: JSON.stringify({ to: '5581999990000', text: 'texto' }),
      })
    )
  })

  it('gateway sem URL/token falha sem retry', async () => {
    vi.stubEnv('WHATSAPP_PROVIDER', 'gateway')
    await expect(providerAtual().enviar('55', 'texto')).rejects.toMatchObject({
      message: 'WHATSAPP_GATEWAY_URL e WHATSAPP_GATEWAY_TOKEN são obrigatórios',
      temporario: false,
    })
  })

  it('gateway 429/5xx vira erro temporário; 400 vira permanente', async () => {
    vi.stubEnv('WHATSAPP_PROVIDER', 'gateway')
    vi.stubEnv('WHATSAPP_GATEWAY_URL', 'http://gateway.test')
    vi.stubEnv('WHATSAPP_GATEWAY_TOKEN', 'secret')
    const fetchMock = vi.spyOn(globalThis, 'fetch')
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ error: 'fila cheia' }), { status: 429 }))
    await expect(providerAtual().enviar('55', 'texto')).rejects.toMatchObject({ message: 'fila cheia', temporario: true })

    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ error: 'grupo bloqueado' }), { status: 422 }))
    await expect(providerAtual().enviar('55', 'texto')).rejects.toMatchObject({ message: 'grupo bloqueado', temporario: false })
  })
})

describe('normalizarTelefoneE164', () => {
  it('celular BR com ou sem máscara/DDI vira 55+DDD+número', () => {
    expect(normalizarTelefoneE164('(81) 99999-0000')).toBe('5581999990000')
    expect(normalizarTelefoneE164('81 3333-0000')).toBe('558133330000')
    expect(normalizarTelefoneE164('+55 81 99999-0000')).toBe('5581999990000')
    expect(normalizarTelefoneE164('558133330000')).toBe('558133330000')
  })

  it('inválido devolve null', () => {
    expect(normalizarTelefoneE164(null)).toBeNull()
    expect(normalizarTelefoneE164(undefined)).toBeNull()
    expect(normalizarTelefoneE164('12345')).toBeNull()
    expect(normalizarTelefoneE164('4481999990000')).toBeNull()
  })
})

describe('erroTemporario (retry só para 429/5xx/rede)', () => {
  it('WhatsAppError respeita a flag', () => {
    expect(erroTemporario(new WhatsAppError('x', true))).toBe(true)
    expect(erroTemporario(new WhatsAppError('x', false))).toBe(false)
  })

  it('status HTTP', () => {
    expect(erroTemporario({ response: { status: 429 } })).toBe(true)
    expect(erroTemporario({ response: { status: 503 } })).toBe(true)
    expect(erroTemporario({ response: { status: 400 } })).toBe(false)
  })

  it('códigos de rede', () => {
    for (const code of ['ECONNRESET', 'ETIMEDOUT', 'ECONNABORTED', 'ENOTFOUND', 'EAI_AGAIN']) {
      expect(erroTemporario({ code })).toBe(true)
    }
    expect(erroTemporario({ code: 'EOUTRO' })).toBe(false)
    expect(erroTemporario(new Error('x'))).toBe(false)
    expect(erroTemporario(null)).toBe(false)
  })
})

describe('enviarComRetry', () => {
  it('sucesso na primeira tentativa', async () => {
    const enviar = vi.fn().mockResolvedValueOnce({ id: 'm1' })
    expect(await enviarComRetry(fake(enviar), '55', 't', 0)).toEqual({ ok: true, id: 'm1', tentativas: 1 })
  })

  it('erro temporário repete e pode ter sucesso na segunda', async () => {
    const enviar = vi.fn().mockRejectedValueOnce({ response: { status: 500 } }).mockResolvedValueOnce({ id: 'm2' })
    expect(await enviarComRetry(fake(enviar), '55', 't', 0)).toEqual({ ok: true, id: 'm2', tentativas: 2 })
  })

  it('espera esperaMs * tentativa antes de repetir (padrão 1500ms)', async () => {
    vi.useFakeTimers()
    try {
      const enviar = vi.fn().mockRejectedValueOnce({ code: 'ETIMEDOUT' }).mockResolvedValueOnce({})
      const p = enviarComRetry(fake(enviar), '55', 't')
      await vi.advanceTimersByTimeAsync(1499)
      expect(enviar).toHaveBeenCalledTimes(1)
      await vi.advanceTimersByTimeAsync(1)
      expect(await p).toEqual({ ok: true, id: undefined, tentativas: 2 })
    } finally {
      vi.useRealTimers()
    }
  })

  it('erro permanente não repete; mensagem vem do response.data (string)', async () => {
    const enviar = vi.fn().mockRejectedValueOnce({ response: { status: 400, data: 'número inválido' } })
    expect(await enviarComRetry(fake(enviar), '55', 't', 0)).toEqual({ ok: false, erro: 'número inválido', tentativas: 1 })
    expect(enviar).toHaveBeenCalledTimes(1)
  })

  it('erro temporário até o limite: falha com MAX_TENTATIVAS e data em JSON', async () => {
    const enviar = vi.fn().mockRejectedValue({ response: { status: 503, data: { erro: 'fora' } } })
    const r = await enviarComRetry(fake(enviar), '55', 't', 0)
    expect(r).toEqual({ ok: false, erro: '{"erro":"fora"}', tentativas: MAX_TENTATIVAS })
    expect(enviar).toHaveBeenCalledTimes(MAX_TENTATIVAS)
  })

  it('mensagem de Error e de valor não-Error', async () => {
    const r1 = await enviarComRetry(fake(vi.fn().mockRejectedValueOnce(new Error('boom'))), '55', 't', 0)
    expect(r1).toMatchObject({ ok: false, erro: 'boom' })
    const r2 = await enviarComRetry(fake(vi.fn().mockRejectedValueOnce('texto cru')), '55', 't', 0)
    expect(r2).toMatchObject({ ok: false, erro: 'texto cru' })
  })
})
