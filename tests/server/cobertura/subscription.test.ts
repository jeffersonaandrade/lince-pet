import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const prismaMock = vi.hoisted(() => ({
  subscriptionPlan: { findUnique: vi.fn(), findMany: vi.fn() },
  agendamento: { count: vi.fn() },
  veterinario: { update: vi.fn() },
  prestador: { update: vi.fn() },
}))
vi.mock('@/server/db', () => ({ prisma: prismaMock }))

import {
  canCreateAppointment,
  decrementUsage,
  hasFeature,
  incrementUsage,
  listarPlanosAtivos,
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
  prismaMock.agendamento.count.mockResolvedValue(0)
  vi.useFakeTimers()
  vi.setSystemTime(AGORA)
  prismaMock.veterinario.update.mockResolvedValue({})
  prismaMock.prestador.update.mockResolvedValue({})
})

afterEach(() => {
  vi.useRealTimers()
})

describe('listarPlanosAtivos', () => {
  const ordem = [{ searchPriority: 'asc' }, { priceCents: 'asc' }]

  it('sem tipo, lista somente os códigos contratáveis ativos', async () => {
    prismaMock.subscriptionPlan.findMany.mockResolvedValue([{ code: 'free' }])
    await expect(listarPlanosAtivos()).resolves.toEqual([{ code: 'free', trialDays: 0 }])
    expect(prismaMock.subscriptionPlan.findMany).toHaveBeenCalledWith({ where: { active: 1, code: { in: ['free', 'vet_pro', 'starter', 'clinic', 'clinic_pro', 'pro'] } }, orderBy: ordem })
  })

  it('veterinário só recebe Gratuito e Pro, mesmo antes da migração do Starter', async () => {
    prismaMock.subscriptionPlan.findMany.mockResolvedValue([])
    await listarPlanosAtivos('veterinario')
    expect(prismaMock.subscriptionPlan.findMany).toHaveBeenCalledWith({
      where: { active: 1, code: { in: ['free', 'vet_pro'] } }, orderBy: ordem,
    })
  })

  it('com tipo, filtra pelos planos que o tipo pode contratar', async () => {
    prismaMock.subscriptionPlan.findMany.mockResolvedValue([])
    await listarPlanosAtivos('clinica')
    expect(prismaMock.subscriptionPlan.findMany).toHaveBeenCalledWith({
      where: { active: 1, code: { in: ['starter', 'clinic', 'clinic_pro'] } },
      orderBy: ordem,
    })
  })
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
  it('plano desconhecido continua bloqueado', async () => {
    prismaMock.subscriptionPlan.findUnique.mockResolvedValue(null)
    expect(await canCreateAppointment(uso({ subscriptionPlanCode: 'inexistente' }))).toEqual({ allowed: false, reason: 'Plano não encontrado' })
  })
  it.each([null, 'none', 'free'])('código %s resolve o gratuito e libera abaixo de cinco', async subscriptionPlanCode => {
    prismaMock.subscriptionPlan.findUnique.mockResolvedValue({ monthlyAppointmentLimit: 10 })
    prismaMock.agendamento.count.mockResolvedValue(4)
    expect(await canCreateAppointment(uso({ subscriptionPlanCode, monthlyAppointmentsUsed: 99 }))).toEqual({ allowed: true })
    expect(prismaMock.subscriptionPlan.findUnique).toHaveBeenCalledWith({ where: { code: 'free' } })
    expect(prismaMock.veterinario.update).not.toHaveBeenCalled()
  })
  it.each(['veterinario', 'prestador'] as const)('%s: quinta usada bloqueia a sexta reserva', async tipo => {
    prismaMock.subscriptionPlan.findUnique.mockResolvedValue({ monthlyAppointmentLimit: 10 })
    prismaMock.agendamento.count.mockResolvedValue(5)
    expect(await canCreateAppointment(uso(), tipo)).toEqual({ allowed: false, reason: 'Limite mensal atingido', limit: 5, used: 5 })
    expect(prismaMock.agendamento.count).toHaveBeenCalledWith({ where: expect.objectContaining({ [tipo === 'veterinario' ? 'veterinarioId' : 'prestadorId']: 'vet-1', cotaLiberadaEm: null }) })
  })
  it('plano pago ilimitado e cortesia não consultam nem zeram contador', async () => {
    prismaMock.subscriptionPlan.findUnique.mockResolvedValue({ monthlyAppointmentLimit: null })
    expect(await canCreateAppointment(uso({ subscriptionPlanCode: 'vet_pro' }))).toEqual({ allowed: true })
    expect(prismaMock.agendamento.count).not.toHaveBeenCalled()
    expect(prismaMock.veterinario.update).not.toHaveBeenCalled()
  })
  it('Starter inativo no catálogo preserva acesso ilimitado de assinante existente', async () => {
    prismaMock.subscriptionPlan.findUnique.mockResolvedValue({ active: 0, monthlyAppointmentLimit: null })
    expect(await canCreateAppointment(uso({ subscriptionPlanCode: 'vet_starter' }))).toEqual({ allowed: true })
    expect(prismaMock.agendamento.count).not.toHaveBeenCalled()
  })
  it('virada mensal consulta novo período, preservando histórico e sem escrita em GET', async () => {
    prismaMock.subscriptionPlan.findUnique.mockResolvedValue({ monthlyAppointmentLimit: 5 })
    vi.setSystemTime(new Date('2026-11-01T03:00:00Z'))
    expect(await canCreateAppointment(uso({ monthlyAppointmentsUsed: 5 }))).toEqual({ allowed: true })
    expect(prismaMock.agendamento.count).toHaveBeenCalledWith({ where: expect.objectContaining({ cotaConsumidaEm: { gte: new Date('2026-11-01T03:00:00Z'), lt: new Date('2026-12-01T03:00:00Z') } }) })
    expect(prismaMock.veterinario.update).not.toHaveBeenCalled()
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
