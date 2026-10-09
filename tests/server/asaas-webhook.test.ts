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

  it('grava o evento processado com a chave de idempotência', async () => {
    prismaMock.subscription.findFirst.mockResolvedValue(subVet())
    await expect(handleAsaasEvent(pagamento('PAYMENT_CONFIRMED'))).resolves.toBe(true)
    expect(prismaMock.webhookEvent.create.mock.calls[0][0].data).toMatchObject({
      provider: 'asaas',
      eventId: 'evt_PAYMENT_CONFIRMED',
      type: 'PAYMENT_CONFIRMED',
    })
  })

  it('evento concorrente (unique violado) é ignorado sem erro', async () => {
    const { Prisma } = await import('@prisma/client')
    prismaMock.webhookEvent.create.mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError('dup', { code: 'P2002', clientVersion: 'x' })
    )
    await expect(handleAsaasEvent(pagamento('PAYMENT_CONFIRMED'))).resolves.toBe(false)
  })

  it('erro inesperado sobe para o Asaas reenviar', async () => {
    prismaMock.subscription.findFirst.mockRejectedValueOnce(new Error('db fora'))
    await expect(handleAsaasEvent(pagamento('PAYMENT_CONFIRMED'))).rejects.toThrow('db fora')
  })

  it('PAYMENT_RECEIVED depois do CONFIRMED não reaplica o plano nem zera o contador', async () => {
    prismaMock.subscription.findFirst.mockResolvedValue(subVet({ status: 'active' }))
    prismaMock.veterinario.findUnique.mockResolvedValue({ subscriptionPlanCode: 'vet_pro' })
    await handleAsaasEvent(pagamento('PAYMENT_RECEIVED'))
    expect(statusGravado()).toEqual(['active'])
    expect(prismaMock.veterinario.update).not.toHaveBeenCalled()
  })

  it('pagamento sem vencimento ativa sem mexer no período', async () => {
    prismaMock.subscription.findFirst.mockResolvedValue(subVet())
    await handleAsaasEvent(evento('PAYMENT_CONFIRMED', { payment: { id: 'pay_1', subscription: 'sub_asaas_1' } }))
    const data = prismaMock.subscription.update.mock.calls[0][0].data
    expect(data.status).toBe('active')
    expect(data).not.toHaveProperty('currentPeriodStart')
  })

  it('falha ao cancelar a antiga no Asaas ainda cancela localmente', async () => {
    prismaMock.subscription.findFirst.mockResolvedValue(subVet())
    prismaMock.subscription.findMany.mockResolvedValue([subVet({ id: 'sub-velha', asaasSubscriptionId: 'sub_velha', status: 'active' })])
    asaasFake.cancelSubscription.mockRejectedValueOnce(new Error('500'))
    await handleAsaasEvent(pagamento('PAYMENT_CONFIRMED'))
    expect(statusGravado()).toEqual(['active', 'canceled'])
    expect(prismaMock.veterinario.update).toHaveBeenCalled()
  })

  it('plano novo da clínica é aplicado na clínica', async () => {
    prismaMock.subscription.findFirst.mockResolvedValue(subVet({ veterinarioId: null, clinicaId: 'cli-1' }))
    prismaMock.subscriptionPlan.findUnique.mockResolvedValue({ id: 'plan-pro', code: 'clinic' })
    prismaMock.clinica.findUnique.mockResolvedValue({ subscriptionPlanCode: 'starter' })
    await handleAsaasEvent(pagamento('PAYMENT_CONFIRMED'))
    expect(prismaMock.clinica.update.mock.calls[0][0].data.subscriptionPlanCode).toBe('clinic')
  })
})

describe('webhook Asaas: eventos ignorados', () => {
  it('cobrança avulsa (sem assinatura) não mexe em nada', async () => {
    await handleAsaasEvent(evento('PAYMENT_CONFIRMED', { payment: { id: 'pay_x' } }))
    expect(prismaMock.subscription.findFirst).not.toHaveBeenCalled()
  })

  it('assinatura que não é da plataforma não mexe em nada', async () => {
    prismaMock.subscription.findFirst.mockResolvedValue(null)
    await handleAsaasEvent(pagamento('PAYMENT_CONFIRMED'))
    expect(prismaMock.subscription.update).not.toHaveBeenCalled()
  })

  it.each(['PAYMENT_CREATED', 'PAYMENT_UPDATED', 'PAYMENT_CREDIT_CARD_CAPTURE_REFUSED', 'SUBSCRIPTION_UPDATED'])(
    '%s mantém o status e o plano',
    async (ev) => {
      prismaMock.subscription.findFirst.mockResolvedValue(subVet())
      await handleAsaasEvent(ev.startsWith('SUBSCRIPTION') ? evento(ev, { subscription: { id: 'sub_asaas_1' } }) : pagamento(ev))
      expect(prismaMock.subscription.update).not.toHaveBeenCalled()
      expect(prismaMock.veterinario.update).not.toHaveBeenCalled()
    }
  )
})

describe('webhook Asaas: inadimplência', () => {
  it.each(['PAYMENT_OVERDUE', 'PAYMENT_REFUNDED', 'PAYMENT_CHARGEBACK_REQUESTED', 'PAYMENT_RECEIVED_IN_CASH_UNDONE'])(
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

  it('fim do teste sem pagamento: vence e o vet perde o plano', async () => {
    prismaMock.subscription.findFirst.mockResolvedValue(subVet({ status: 'active', trialEnd: new Date() }))
    prismaMock.veterinario.findUnique.mockResolvedValue({ subscriptionPlanCode: 'vet_starter' })
    await handleAsaasEvent(pagamento('PAYMENT_OVERDUE'))
    expect(statusGravado()).toEqual(['past_due'])
    expect(prismaMock.veterinario.update.mock.calls[0][0].data.subscriptionPlanCode).toBe('none')
  })

  it('troca pendente vencida não derruba o plano atual pago', async () => {
    prismaMock.subscription.findFirst.mockResolvedValue(subVet({ status: 'pending' }))
    prismaMock.subscription.count.mockResolvedValue(1)
    await handleAsaasEvent(pagamento('PAYMENT_OVERDUE'))
    expect(statusGravado()).toEqual(['past_due'])
    expect(prismaMock.veterinario.update).not.toHaveBeenCalled()
  })

  it('assinatura já cancelada ignora fatura vencida', async () => {
    prismaMock.subscription.findFirst.mockResolvedValue(subVet({ status: 'canceled' }))
    await handleAsaasEvent(pagamento('PAYMENT_OVERDUE'))
    expect(prismaMock.subscription.update).not.toHaveBeenCalled()
  })

  it('prestador inadimplente volta ao free sem zerar o contador', async () => {
    prismaMock.subscription.findFirst.mockResolvedValue(subVet({ veterinarioId: null, prestadorId: 'pre-1', status: 'active' }))
    prismaMock.prestador.findUnique.mockResolvedValue({ subscriptionPlanCode: 'pro' })
    await handleAsaasEvent(pagamento('PAYMENT_OVERDUE'))
    const data = prismaMock.prestador.update.mock.calls[0][0].data
    expect(data.subscriptionPlanCode).toBe('free')
    expect(data).not.toHaveProperty('monthlyAppointmentsUsed')
  })

  it('dono já sem plano não é atualizado de novo', async () => {
    prismaMock.subscription.findFirst.mockResolvedValue(subVet({ status: 'active' }))
    prismaMock.veterinario.findUnique.mockResolvedValue({ subscriptionPlanCode: 'none' })
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

  it('mantém a data de cancelamento já gravada', async () => {
    const canceledAt = new Date('2026-10-01T10:00:00Z')
    prismaMock.subscription.findFirst.mockResolvedValue(subVet({ status: 'past_due', canceledAt }))
    await handleAsaasEvent(evento('SUBSCRIPTION_DELETED', { subscription: { id: 'sub_asaas_1' } }))
    expect(prismaMock.subscription.update.mock.calls[0][0].data.canceledAt).toBe(canceledAt)
  })

  it('encerramento identificado pelo payment.subscription também funciona', async () => {
    prismaMock.subscription.findFirst.mockResolvedValue(subVet({ status: 'active' }))
    prismaMock.veterinario.findUnique.mockResolvedValue({ subscriptionPlanCode: 'vet_pro' })
    await handleAsaasEvent(evento('SUBSCRIPTION_INACTIVATED', { payment: { subscription: 'sub_asaas_1' } }))
    expect(prismaMock.subscription.findFirst.mock.calls[0][0].where).toEqual({ asaasSubscriptionId: 'sub_asaas_1' })
    expect(statusGravado()).toEqual(['canceled'])
  })
})
