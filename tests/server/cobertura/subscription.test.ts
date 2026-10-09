import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const prismaMock = vi.hoisted(() => ({
  subscriptionPlan: { findUnique: vi.fn() },
  veterinario: { update: vi.fn() },
  prestador: { update: vi.fn() },
}))
vi.mock('@/server/db', () => ({ prisma: prismaMock }))

import {
  canCreateAppointment,
  decrementUsage,
  hasFeature,
  incrementUsage,
  resetMonthlyCounterIfNeeded,
} from '@/server/services/subscription'

const AGORA = new Date(2026, 9, 9, 12, 0, 0)

const uso = (over: Partial<{ subscriptionPlanCode: string | null; monthlyAppointmentsUsed: number | null; monthlyAppointmentsResetAt: Date | null }> = {}) => ({
  id: 'vet-1',
  subscriptionPlanCode: 'free',
  monthlyAppointmentsUsed: 0,
  monthlyAppointmentsResetAt: new Date(2026, 9, 1),
  ...over,
})

beforeEach(() => {
  vi.clearAllMocks()
  vi.useFakeTimers()
  vi.setSystemTime(AGORA)
  prismaMock.veterinario.update.mockResolvedValue({})
  prismaMock.prestador.update.mockResolvedValue({})
})

afterEach(() => {
  vi.useRealTimers()
})

describe('resetMonthlyCounterIfNeeded', () => {
  it('mesmo mês e ano: não zera', async () => {
    const v = uso({ monthlyAppointmentsUsed: 3 })
    await resetMonthlyCounterIfNeeded(v)
    expect(prismaMock.veterinario.update).not.toHaveBeenCalled()
    expect(v.monthlyAppointmentsUsed).toBe(3)
  })

  it('sem data de reset: zera e grava a data atual no veterinário', async () => {
    const v = uso({ monthlyAppointmentsUsed: 7, monthlyAppointmentsResetAt: null })
    await resetMonthlyCounterIfNeeded(v)
    expect(v.monthlyAppointmentsUsed).toBe(0)
    expect(prismaMock.veterinario.update).toHaveBeenCalledWith({
      where: { id: 'vet-1' },
      data: expect.objectContaining({ monthlyAppointmentsUsed: 0, monthlyAppointmentsResetAt: AGORA, updatedAt: expect.any(Date) }),
    })
  })

  it('mês anterior: zera', async () => {
    const v = uso({ monthlyAppointmentsUsed: 5, monthlyAppointmentsResetAt: new Date(2026, 8, 30) })
    await resetMonthlyCounterIfNeeded(v)
    expect(v.monthlyAppointmentsUsed).toBe(0)
  })

  it('mesmo mês de outro ano: zera, e no prestador grava na tabela de prestadores', async () => {
    const v = uso({ monthlyAppointmentsUsed: 5, monthlyAppointmentsResetAt: new Date(2025, 9, 9) })
    await resetMonthlyCounterIfNeeded(v, 'prestador')
    expect(prismaMock.prestador.update).toHaveBeenCalledTimes(1)
    expect(prismaMock.veterinario.update).not.toHaveBeenCalled()
  })
})

describe('canCreateAppointment', () => {
  it('plano inexistente bloqueia', async () => {
    prismaMock.subscriptionPlan.findUnique.mockResolvedValueOnce(null)
    expect(await canCreateAppointment(uso())).toEqual({ allowed: false, reason: 'Plano não encontrado' })
  })

  it('sem código de plano procura o free', async () => {
    prismaMock.subscriptionPlan.findUnique.mockResolvedValueOnce({ monthlyAppointmentLimit: null })
    await canCreateAppointment(uso({ subscriptionPlanCode: null }))
    expect(prismaMock.subscriptionPlan.findUnique).toHaveBeenCalledWith({ where: { code: 'free' } })
  })

  it('plano ilimitado libera sem mexer no contador', async () => {
    prismaMock.subscriptionPlan.findUnique.mockResolvedValueOnce({ monthlyAppointmentLimit: null })
    expect(await canCreateAppointment(uso({ subscriptionPlanCode: 'pro', monthlyAppointmentsResetAt: null }))).toEqual({ allowed: true })
    expect(prismaMock.veterinario.update).not.toHaveBeenCalled()
  })

  it('prestador free: 10 pedidos/mês; no limite bloqueia com limite e uso', async () => {
    prismaMock.subscriptionPlan.findUnique.mockResolvedValueOnce({ monthlyAppointmentLimit: 10 })
    const r = await canCreateAppointment(uso({ monthlyAppointmentsUsed: 10 }), 'prestador')
    expect(r).toEqual({ allowed: false, reason: 'Limite mensal atingido', limit: 10, used: 10 })
  })

  it('abaixo do limite libera', async () => {
    prismaMock.subscriptionPlan.findUnique.mockResolvedValueOnce({ monthlyAppointmentLimit: 10 })
    expect(await canCreateAppointment(uso({ monthlyAppointmentsUsed: 9 }))).toEqual({ allowed: true })
  })

  it('contador nulo conta como zero', async () => {
    prismaMock.subscriptionPlan.findUnique.mockResolvedValueOnce({ monthlyAppointmentLimit: 1 })
    expect(await canCreateAppointment(uso({ monthlyAppointmentsUsed: null }))).toEqual({ allowed: true })
  })

  it('limite zero com contador nulo bloqueia e informa uso 0', async () => {
    prismaMock.subscriptionPlan.findUnique.mockResolvedValueOnce({ monthlyAppointmentLimit: 0 })
    expect(await canCreateAppointment(uso({ monthlyAppointmentsUsed: null }))).toMatchObject({ allowed: false, used: 0, limit: 0 })
  })

  it('virada de mês zera antes de comparar: quem estourou no mês passado volta a poder', async () => {
    prismaMock.subscriptionPlan.findUnique.mockResolvedValueOnce({ monthlyAppointmentLimit: 10 })
    const v = uso({ monthlyAppointmentsUsed: 10, monthlyAppointmentsResetAt: new Date(2026, 8, 15) })
    expect(await canCreateAppointment(v, 'prestador')).toEqual({ allowed: true })
    expect(prismaMock.prestador.update).toHaveBeenCalledTimes(1)
  })
})

describe('incrementUsage / decrementUsage', () => {
  it('pedido criado conta no mês (vet e prestador)', async () => {
    const v = uso({ monthlyAppointmentsUsed: 2 })
    await incrementUsage(v)
    expect(v.monthlyAppointmentsUsed).toBe(3)
    expect(prismaMock.veterinario.update.mock.calls[0][0].data.monthlyAppointmentsUsed).toBe(3)

    const p = uso({ monthlyAppointmentsUsed: null })
    await incrementUsage(p, 'prestador')
    expect(prismaMock.prestador.update.mock.calls[0][0].data.monthlyAppointmentsUsed).toBe(1)
  })

  it('recusa ou cancelamento devolve a cota', async () => {
    const v = uso({ monthlyAppointmentsUsed: 2 })
    await decrementUsage(v, 'prestador')
    expect(v.monthlyAppointmentsUsed).toBe(1)
    expect(prismaMock.prestador.update.mock.calls[0][0].data.monthlyAppointmentsUsed).toBe(1)

    await decrementUsage(uso({ monthlyAppointmentsUsed: 4 }))
    expect(prismaMock.veterinario.update.mock.calls[0][0].data.monthlyAppointmentsUsed).toBe(3)
  })

  it('contador zerado ou nulo não fica negativo', async () => {
    await decrementUsage(uso({ monthlyAppointmentsUsed: 0 }))
    await decrementUsage(uso({ monthlyAppointmentsUsed: null }), 'prestador')
    expect(prismaMock.veterinario.update).not.toHaveBeenCalled()
    expect(prismaMock.prestador.update).not.toHaveBeenCalled()
  })
})

describe('hasFeature', () => {
  it('features como array', async () => {
    prismaMock.subscriptionPlan.findUnique.mockResolvedValueOnce({ features: ['whatsapp_notifications'] })
    expect(await hasFeature({ subscriptionPlanCode: 'pro' }, 'whatsapp_notifications')).toBe(true)
  })

  it('features como JSON em string', async () => {
    prismaMock.subscriptionPlan.findUnique.mockResolvedValueOnce({ features: '["financeiro"]' })
    expect(await hasFeature({ subscriptionPlanCode: 'vet_pro' }, 'financeiro')).toBe(true)
    prismaMock.subscriptionPlan.findUnique.mockResolvedValueOnce({ features: '["financeiro"]' })
    expect(await hasFeature({ subscriptionPlanCode: 'vet_pro' }, 'whatsapp_notifications')).toBe(false)
  })

  it('JSON inválido, objeto não-array, sem features ou sem plano: false', async () => {
    prismaMock.subscriptionPlan.findUnique.mockResolvedValueOnce({ features: '{quebrado' })
    expect(await hasFeature({ subscriptionPlanCode: 'x' }, 'a')).toBe(false)
    prismaMock.subscriptionPlan.findUnique.mockResolvedValueOnce({ features: { a: true } })
    expect(await hasFeature({ subscriptionPlanCode: 'x' }, 'a')).toBe(false)
    prismaMock.subscriptionPlan.findUnique.mockResolvedValueOnce({ features: null })
    expect(await hasFeature({ subscriptionPlanCode: 'x' }, 'a')).toBe(false)
    prismaMock.subscriptionPlan.findUnique.mockResolvedValueOnce(null)
    expect(await hasFeature({ subscriptionPlanCode: null }, 'a')).toBe(false)
  })
})
