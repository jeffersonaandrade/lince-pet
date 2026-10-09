import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const resend = vi.hoisted(() => ({ send: vi.fn(), chaves: [] as unknown[] }))
vi.mock('resend', () => ({
  Resend: class {
    emails = { send: resend.send }
    constructor(key: unknown) {
      resend.chaves.push(key)
    }
  },
}))

type Mail = typeof import('@/server/services/mail')
let mail: Mail

beforeEach(async () => {
  vi.resetModules()
  resend.send.mockReset()
  resend.chaves.length = 0
  vi.stubEnv('RESEND_API_KEY', 're_falso')
  vi.stubEnv('EMAIL_FROM', '')
  mail = await import('@/server/services/mail')
})

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('sendMail', () => {
  it('envia pelo Resend com o remetente padrão', async () => {
    resend.send.mockResolvedValueOnce({ data: { id: '1' }, error: null })
    await mail.sendMail({ to: 'a@b.com', subject: 'Oi', html: '<p>x</p>' })
    expect(resend.chaves).toEqual(['re_falso'])
    expect(resend.send).toHaveBeenCalledWith({ from: 'onboarding@resend.dev', to: 'a@b.com', subject: 'Oi', html: '<p>x</p>' })
  })

  it('usa EMAIL_FROM quando configurado e from explícito tem prioridade', async () => {
    vi.stubEnv('EMAIL_FROM', 'Lince <no-reply@lince.pet>')
    resend.send.mockResolvedValue({ error: null })
    await mail.sendMail({ to: 'a@b.com', subject: 's', html: 'h' })
    await mail.sendMail({ to: 'a@b.com', subject: 's', html: 'h', from: 'outro@lince.pet' })
    expect(resend.send.mock.calls[0][0].from).toBe('Lince <no-reply@lince.pet>')
    expect(resend.send.mock.calls[1][0].from).toBe('outro@lince.pet')
    expect(resend.chaves).toHaveLength(1)
  })

  it('erro do Resend vira exceção com nome e mensagem', async () => {
    resend.send.mockResolvedValueOnce({ data: null, error: { name: 'validation_error', message: 'to inválido' } })
    await expect(mail.sendMail({ to: 'x', subject: 's', html: 'h' })).rejects.toThrow('[mail] validation_error: to inválido')
  })

  it('sem RESEND_API_KEY lança antes de enviar', async () => {
    vi.stubEnv('RESEND_API_KEY', '')
    await expect(mail.sendMail({ to: 'a@b.com', subject: 's', html: 'h' })).rejects.toThrow('RESEND_API_KEY')
    expect(resend.send).not.toHaveBeenCalled()
  })
})

describe('escapeHtml', () => {
  it('escapa os caracteres especiais do HTML', () => {
    expect(mail.escapeHtml(`<a href="x">Tom & 'Jerry'</a>`)).toBe(
      '&lt;a href=&quot;x&quot;&gt;Tom &amp; &#39;Jerry&#39;&lt;/a&gt;'
    )
  })

  it('null/undefined viram string vazia e números viram texto', () => {
    expect(mail.escapeHtml(null)).toBe('')
    expect(mail.escapeHtml(undefined)).toBe('')
    expect(mail.escapeHtml(42)).toBe('42')
  })
})
