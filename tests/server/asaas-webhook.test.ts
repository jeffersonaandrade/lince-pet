import { describe, it, expect, vi } from 'vitest'

vi.mock('@/server/db', () => ({ prisma: {} }))

import { asaasEventKey } from '@/server/services/asaas-webhook'

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
