import { describe, it, expect, vi, beforeEach } from 'vitest'

const prismaMock = vi.hoisted(() => {
  const m: any = {
    webhookEvent: { findUnique: vi.fn(), create: vi.fn() },
    subscription: { findFirst: vi.fn(), findMany: vi.fn(), update: vi.fn(), count: vi.fn() },
    subscriptionPlan: { findUnique: vi.fn() },
    veterinario: { findUnique: vi.fn(), update: vi.fn() },
    clinica: { findUnique: vi.fn(), update: vi.fn() },
    prestador: { findUnique: vi.fn(), update: vi.fn() },
  }
  m.$transaction = vi.fn(async (fn: (tx: unknown) => unknown) => fn(m))
  return m
})
vi.mock('@/server/db', () => ({ prisma: prismaMock }))

const asaasFake = vi.hoisted(() => ({ cancelSubscription: vi.fn() }))
vi.mock('@/server/services/asaas', () => ({ AsaasService: vi.fn(() => asaasFake) }))

import { asaasEventKey, handleAsaasEvent } from '@/server/services/asaas-webhook'

describe('asaasEventKey (idempotência do webhook Asaas)', () => {
  it('usa o id do evento enviado pelo Asaas', () => {
    expect(asaasEventKey({ id: 'evt_abc&123', event: 'PAYMENT_CONFIRMED', payment: { id: 'pay_1' } })).toBe('evt_abc&123')
  })

  it('sem id, combina tipo do evento e id do pagamento/assinatura', () => {
    expect(asaasEventKey({ event: 'PAYMENT_RECEIVED', payment: { id: 'pay_1' } })).toBe('asaas:PAYMENT_RECEIVED:pay_1')
    expect(asaasEventKey({ event: 'SUBSCRIPTION_DELETED', subscription: { id: 'sub_1' } })).toBe(
      'asaas:SUBSCRIPTION_DELETED:sub_1'
    )
  })

  it('retorna null quando não há como identificar o evento', () => {
    expect(asaasEventKey({})).toBeNull()
    expect(asaasEventKey({ event: 'PAYMENT_CONFIRMED' })).toBeNull()
    expect(asaasEventKey(null)).toBeNull()
  })
})

const subVet = (over: Record<string, unknown> = {}) => ({
  id: 'sub-1',
  veterinarioId: 'vet-1',
  clinicaId: null,
  prestadorId: null,
  planId: 'plan-pro',
  asaasSubscriptionId: 'sub_asaas_1',
  status: 'pending',
  canceledAt: null,
  ...over,
})

const evento = (event: string, extra: Record<string, unknown>) => ({ id: `evt_${event}`, event, ...extra })
const pagamento = (event: string) => evento(event, { payment: { id: 'pay_1', subscription: 'sub_asaas_1', dueDate: '2026-10-09' } })
const statusGravado = () => prismaMock.subscription.update.mock.calls.map((c: any[]) => c[0].data.status)

beforeEach(() => {
  vi.clearAllMocks()
  prismaMock.webhookEvent.findUnique.mockResolvedValue(null)
  prismaMock.subscription.findMany.mockResolvedValue([])
  prismaMock.subscription.count.mockResolvedValue(0)
  prismaMock.subscriptionPlan.findUnique.mockResolvedValue({ id: 'plan-pro', code: 'vet_pro' })
  prismaMock.veterinario.findUnique.mockResolvedValue({ subscriptionPlanCode: 'none' })
})

describe('webhook Asaas: pagamento confirmado', () => {
  it('ativa, grava o período pago e aplica o plano', async () => {
    prismaMock.subscription.findFirst.mockResolvedValue(subVet())
    await handleAsaasEvent(pagamento('PAYMENT_CONFIRMED'))

    const data = prismaMock.subscription.update.mock.calls[0][0].data
    expect(data.status).toBe('active')
    expect(data.currentPeriodStart.toISOString()).toBe('2026-10-09T00:00:00.000Z')
    expect(data.currentPeriodEnd.toISOString()).toBe('2026-11-09T23:59:59.000Z')
    expect(prismaMock.veterinario.update.mock.calls[0][0].data.subscriptionPlanCode).toBe('vet_pro')
  })

  it('cancela no Asaas e localmente a assinatura antiga ao confirmar a troca', async () => {
    prismaMock.subscription.findFirst.mockResolvedValue(subVet())
    prismaMock.subscription.findMany.mockResolvedValue([subVet({ id: 'sub-velha', asaasSubscriptionId: 'sub_velha', status: 'active' })])
    await handleAsaasEvent(pagamento('PAYMENT_RECEIVED'))
    expect(asaasFake.cancelSubscription).toHaveBeenCalledWith('sub_velha')
    expect(statusGravado()).toEqual(['active', 'canceled'])
  })

  it('reativa assinatura inadimplente quando a dívida é paga', async () => {
    prismaMock.subscription.findFirst.mockResolvedValue(subVet({ status: 'past_due' }))
    await handleAsaasEvent(pagamento('PAYMENT_RECEIVED'))
    expect(statusGravado()).toEqual(['active'])
    expect(prismaMock.veterinario.update).toHaveBeenCalled()
  })

  it('não reativa assinatura já cancelada', async () => {
    prismaMock.subscription.findFirst.mockResolvedValue(subVet({ status: 'canceled' }))
    await handleAsaasEvent(pagamento('PAYMENT_CONFIRMED'))
    expect(prismaMock.subscription.update).not.toHaveBeenCalled()
    expect(prismaMock.veterinario.update).not.toHaveBeenCalled()
  })

  it('evento repetido não é processado de novo', async () => {
    prismaMock.webhookEvent.findUnique.mockResolvedValue({ id: 1 })
    await expect(handleAsaasEvent(pagamento('PAYMENT_CONFIRMED'))).resolves.toBe(false)
    expect(prismaMock.subscription.findFirst).not.toHaveBeenCalled()
  })
})

describe('webhook Asaas: inadimplência', () => {
  it.each(['PAYMENT_OVERDUE', 'PAYMENT_REFUNDED', 'PAYMENT_CHARGEBACK_REQUESTED'])(
    '%s marca past_due e o vet fica sem plano',
    async (ev) => {
      prismaMock.subscription.findFirst.mockResolvedValue(subVet({ status: 'active' }))
      prismaMock.veterinario.findUnique.mockResolvedValue({ subscriptionPlanCode: 'vet_pro' })
      await handleAsaasEvent(pagamento(ev))
      expect(statusGravado()).toEqual(['past_due'])
      expect(prismaMock.veterinario.update.mock.calls[0][0].data.subscriptionPlanCode).toBe('none')
    }
  )

  it('não rebaixa se o dono tiver outra assinatura ativa', async () => {
    prismaMock.subscription.findFirst.mockResolvedValue(subVet({ status: 'active' }))
    prismaMock.subscription.count.mockResolvedValue(1)
    await handleAsaasEvent(pagamento('PAYMENT_OVERDUE'))
    expect(prismaMock.veterinario.update).not.toHaveBeenCalled()
  })
})

describe('webhook Asaas: assinatura encerrada', () => {
  it.each(['SUBSCRIPTION_DELETED', 'SUBSCRIPTION_INACTIVATED'])('%s cancela e a clínica fica sem plano', async (ev) => {
    prismaMock.subscription.findFirst.mockResolvedValue(
      subVet({ veterinarioId: null, clinicaId: 'cli-1', status: 'active' })
    )
    prismaMock.clinica.findUnique.mockResolvedValue({ subscriptionPlanCode: 'clinic' })
    await handleAsaasEvent(evento(ev, { subscription: { id: 'sub_asaas_1' } }))
    expect(statusGravado()).toEqual(['canceled'])
    expect(prismaMock.clinica.update.mock.calls[0][0].data.subscriptionPlanCode).toBe('none')
  })

  it('assinatura antiga encerrada após upgrade não derruba o plano novo', async () => {
    prismaMock.subscription.findFirst.mockResolvedValue(
      subVet({ veterinarioId: null, clinicaId: 'cli-1', status: 'canceled' })
    )
    prismaMock.subscription.count.mockResolvedValue(1)
    await handleAsaasEvent(evento('SUBSCRIPTION_DELETED', { subscription: { id: 'sub_asaas_1' } }))
    expect(prismaMock.subscription.update).not.toHaveBeenCalled()
    expect(prismaMock.clinica.update).not.toHaveBeenCalled()
  })
})
