import { describe, it, expect, vi, beforeEach } from 'vitest'

const prismaMock = vi.hoisted(() => ({ user: { update: vi.fn(), findUniqueOrThrow: vi.fn() } }))
vi.mock('@/server/db', () => ({ prisma: prismaMock }))

import { canaisDe, podeEnviarEmail, salvarCanais, serializeCanais } from '@/server/services/canais-notificacao'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('canaisDe', () => {
  it('usuário ausente: e-mail e WhatsApp ligados por padrão, Google Agenda desligado', () => {
    expect(canaisDe(null)).toEqual({ email: true, whatsapp: true, googleAgenda: false })
    expect(canaisDe(undefined)).toEqual({ email: true, whatsapp: true, googleAgenda: false })
    expect(podeEnviarEmail(null)).toBe(true)
  })
})

describe('salvarCanais', () => {
  it('liga/desliga os dois canais com 1/0 e carimba updatedAt', async () => {
    prismaMock.user.update.mockResolvedValueOnce({ notificarEmail: 1, notificarWhatsapp: 0, googleCalendarAuthorized: 1 })
    const r = await salvarCanais('u1', { email: true, whatsapp: false })
    const arg = prismaMock.user.update.mock.calls[0][0]
    expect(arg.where).toEqual({ id: 'u1' })
    expect(arg.data).toMatchObject({ notificarEmail: 1, notificarWhatsapp: 0 })
    expect(arg.data.updatedAt).toBeInstanceOf(Date)
    expect(r).toEqual({ email: true, whatsapp: false, googleAgenda: true })
    expect(prismaMock.user.findUniqueOrThrow).not.toHaveBeenCalled()
  })

  it('só WhatsApp: não mexe no e-mail', async () => {
    prismaMock.user.update.mockResolvedValueOnce({ notificarEmail: 0, notificarWhatsapp: 1 })
    await salvarCanais('u1', { whatsapp: true })
    const { data } = prismaMock.user.update.mock.calls[0][0]
    expect(data.notificarWhatsapp).toBe(1)
    expect(data).not.toHaveProperty('notificarEmail')
  })

  it('desligar o e-mail grava 0 e ligar o WhatsApp grava 1', async () => {
    prismaMock.user.update.mockResolvedValueOnce({ notificarEmail: 0, notificarWhatsapp: 1 })
    expect(await salvarCanais('u1', { email: false, whatsapp: true })).toMatchObject({ email: false, whatsapp: true })
    expect(prismaMock.user.update.mock.calls[0][0].data).toMatchObject({ notificarEmail: 0, notificarWhatsapp: 1 })
  })

  it('sem campos: só lê o usuário, sem update', async () => {
    prismaMock.user.findUniqueOrThrow.mockResolvedValueOnce({ notificarEmail: 0, notificarWhatsapp: 0, googleCalendarAuthorized: 0 })
    expect(await salvarCanais('u1', {})).toEqual({ email: false, whatsapp: false, googleAgenda: false })
    expect(prismaMock.user.findUniqueOrThrow).toHaveBeenCalledWith({ where: { id: 'u1' } })
    expect(prismaMock.user.update).not.toHaveBeenCalled()
  })

  it('usuário inexistente propaga o erro do Prisma', async () => {
    prismaMock.user.findUniqueOrThrow.mockRejectedValueOnce(new Error('No User found'))
    await expect(salvarCanais('nao', {})).rejects.toThrow('No User found')
  })
})

describe('serializeCanais', () => {
  it('usa google_agenda em snake_case', () => {
    expect(serializeCanais({ email: true, whatsapp: false, googleAgenda: true })).toEqual({
      email: true,
      whatsapp: false,
      google_agenda: true,
    })
  })
})
