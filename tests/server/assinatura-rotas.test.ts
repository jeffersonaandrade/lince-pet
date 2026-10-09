import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'

const prismaMock = vi.hoisted(() => ({
  subscriptionPlan: { findUnique: vi.fn() },
  subscription: { findMany: vi.fn(), count: vi.fn() },
}))
vi.mock('@/server/db', () => ({ prisma: prismaMock }))

const sessao = vi.hoisted(() => ({ user: {} as Record<string, unknown> }))
vi.mock('@/server/auth/session', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/server/auth/session')>()),
  requireUser: vi.fn(async () => sessao.user),
}))

const asaasFake = vi.hoisted(() => ({ getSubscriptionPayments: vi.fn() }))
vi.mock('@/server/services/asaas', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/server/services/asaas')>()),
  AsaasService: vi.fn(() => asaasFake),
}))

const webhook = vi.hoisted(() => ({ handleAsaasEvent: vi.fn() }))
vi.mock('@/server/services/asaas-webhook', () => webhook)

import { GET as statusRoute } from '@/app/api/assinaturas/status/route'
import { POST as webhookRoute } from '@/app/api/webhooks/asaas/route'

const ctx = { params: Promise.resolve({}) }
const FUTURO = new Date(Date.now() + 5 * 86_400_000)
const sub = (over: Record<string, unknown>) => ({
  id: 'sub-1',
  planId: 'p-1',
  asaasSubscriptionId: 'sub_asaas_1',
  trialEnd: null,
  ...over,
})

async function status() {
  const res = await statusRoute(new NextRequest('http://localhost/api/assinaturas/status'), ctx)
  expect(res.status).toBe(200)
  return res.json()
}

beforeEach(() => {
  vi.clearAllMocks()
  sessao.user = {
    id: 'u-1',
    userType: 'veterinario',
    veterinario: { id: 'vet-1', subscriptionPlanCode: 'vet_starter', monthlyAppointmentsUsed: 3 },
  }
  prismaMock.subscriptionPlan.findUnique.mockResolvedValue({ code: 'vet_starter', monthlyAppointmentLimit: null })
  prismaMock.subscription.findMany.mockResolvedValue([])
  prismaMock.subscription.count.mockResolvedValue(0)
  asaasFake.getSubscriptionPayments.mockResolvedValue({
    data: [{ status: 'PENDING', dueDate: '2026-10-20', invoiceUrl: 'https://asaas/i/aberta' }],
  })
})

describe('GET /api/assinaturas/status', () => {
  it('conta nova: sem assinatura, teste disponível e sem chamar o Asaas', async () => {
    prismaMock.subscriptionPlan.findUnique.mockResolvedValue(null)
    sessao.user = { id: 'u-1', userType: 'veterinario', veterinario: { id: 'vet-1', subscriptionPlanCode: 'none' } }
    const body = await status()
    expect(body).toMatchObject({ subscription: null, statusLabel: null, testeDisponivel: true, emTeste: false, checkoutUrl: null })
    expect(asaasFake.getSubscriptionPayments).not.toHaveBeenCalled()
  })

  it('em teste: ativa, com fim do teste e sem fatura a pagar', async () => {
    prismaMock.subscription.findMany.mockResolvedValue([sub({ status: 'active', trialEnd: FUTURO })])
    prismaMock.subscription.count.mockResolvedValue(1)
    const body = await status()
    expect(body).toMatchObject({ statusLabel: 'ativa', emTeste: true, testeDisponivel: false, checkoutUrl: null })
    expect(new Date(body.trialEnd).getTime()).toBe(FUTURO.getTime())
  })

  it('teste já encerrado e pago: ativa e não está mais em teste', async () => {
    prismaMock.subscription.findMany.mockResolvedValue([sub({ status: 'active', trialEnd: new Date('2026-01-01') })])
    const body = await status()
    expect(body).toMatchObject({ statusLabel: 'ativa', emTeste: false, trialEnd: null })
  })

  it('troca pendente: mostra a vigente, o plano pendente e o link da fatura nova', async () => {
    prismaMock.subscription.findMany.mockResolvedValue([
      sub({ id: 'nova', status: 'pending', planId: 'p-2', asaasSubscriptionId: 'sub_nova' }),
      sub({ status: 'active' }),
    ])
    const body = await status()
    expect(body.subscription.id).toBe('sub-1')
    expect(body).toMatchObject({ statusLabel: 'ativa', pendingPlanId: 'p-2', checkoutUrl: 'https://asaas/i/aberta' })
    expect(asaasFake.getSubscriptionPayments).toHaveBeenCalledWith('sub_nova')
  })

  it('primeira contratação sem teste: pendente com link para pagar', async () => {
    prismaMock.subscription.findMany.mockResolvedValue([sub({ status: 'pending' })])
    const body = await status()
    expect(body).toMatchObject({ statusLabel: 'pendente', pendingPlanId: null, checkoutUrl: 'https://asaas/i/aberta' })
  })

  it('inadimplente: rótulo e link da fatura vencida', async () => {
    prismaMock.subscription.findMany.mockResolvedValue([sub({ status: 'past_due' })])
    asaasFake.getSubscriptionPayments.mockResolvedValue({
      data: [{ status: 'OVERDUE', dueDate: '2026-09-09', invoiceUrl: 'https://asaas/i/vencida' }],
    })
    const body = await status()
    expect(body).toMatchObject({ statusLabel: 'inadimplente', checkoutUrl: 'https://asaas/i/vencida' })
  })

  it('só canceladas: mostra a mais recente como cancelada, sem link', async () => {
    prismaMock.subscription.findMany.mockResolvedValue([sub({ status: 'canceled' }), sub({ id: 'velha', status: 'expired' })])
    const body = await status()
    expect(body).toMatchObject({ statusLabel: 'cancelada', checkoutUrl: null })
    expect(body.subscription.id).toBe('sub-1')
  })

  it('Asaas fora do ar não derruba o status', async () => {
    prismaMock.subscription.findMany.mockResolvedValue([sub({ status: 'pending' })])
    asaasFake.getSubscriptionPayments.mockRejectedValueOnce(new Error('timeout'))
    const body = await status()
    expect(body).toMatchObject({ statusLabel: 'pendente', checkoutUrl: null })
  })

  it('usa o limite mensal do plano atual', async () => {
    prismaMock.subscriptionPlan.findUnique.mockResolvedValue({ code: 'free', monthlyAppointmentLimit: 10 })
    const body = await status()
    expect(body.usage).toEqual({ used: 3, limit: 10 })
  })

  it('clínica consulta as próprias assinaturas', async () => {
    sessao.user = { id: 'u-2', userType: 'clinica', clinica: { id: 'cli-1', subscriptionPlanCode: 'clinic' } }
    await status()
    expect(prismaMock.subscription.findMany.mock.calls[0][0].where).toEqual({ clinicaId: 'cli-1' })
  })
})

describe('POST /api/webhooks/asaas', () => {
  const TOKEN = 't'.repeat(32)
  const enviar = (token?: string) =>
    webhookRoute(
      new NextRequest('http://localhost/api/webhooks/asaas', {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...(token ? { 'asaas-access-token': token } : {}) },
        body: JSON.stringify({ id: 'evt_1', event: 'PAYMENT_CONFIRMED', payment: { id: 'pay_1' } }),
      }),
      ctx
    )

  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })
  afterEach(() => vi.unstubAllEnvs())

  it('produção sem token configurado: 401 e o evento não é processado', async () => {
    vi.stubEnv('ASAAS_ENV', 'production')
    vi.stubEnv('ASAAS_WEBHOOK_TOKEN', '')
    const res = await enviar(TOKEN)
    expect(res.status).toBe(401)
    expect(webhook.handleAsaasEvent).not.toHaveBeenCalled()
  })

  it('token errado ou ausente: 401', async () => {
    vi.stubEnv('ASAAS_ENV', 'production')
    vi.stubEnv('ASAAS_WEBHOOK_TOKEN', TOKEN)
    expect((await enviar('errado')).status).toBe(401)
    expect((await enviar()).status).toBe(401)
    expect(webhook.handleAsaasEvent).not.toHaveBeenCalled()
  })

  it('token certo: 200 e repassa o payload', async () => {
    vi.stubEnv('ASAAS_ENV', 'production')
    vi.stubEnv('ASAAS_WEBHOOK_TOKEN', TOKEN)
    const res = await enviar(TOKEN)
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ received: true })
    expect(webhook.handleAsaasEvent.mock.calls[0][0]).toMatchObject({ id: 'evt_1', event: 'PAYMENT_CONFIRMED' })
  })

  it('sandbox sem token configurado aceita (teste com ngrok)', async () => {
    vi.stubEnv('ASAAS_ENV', 'sandbox')
    vi.stubEnv('ASAAS_WEBHOOK_TOKEN', '')
    expect((await enviar()).status).toBe(200)
  })

  it('falha no processamento: 500 para o Asaas reenviar', async () => {
    vi.stubEnv('ASAAS_ENV', 'sandbox')
    vi.stubEnv('ASAAS_WEBHOOK_TOKEN', TOKEN)
    webhook.handleAsaasEvent.mockRejectedValueOnce(new Error('db fora'))
    expect((await enviar(TOKEN)).status).toBe(500)
  })
})

describe('AsaasService', () => {
  const real = () => vi.importActual<typeof import('@/server/services/asaas')>('@/server/services/asaas')

  it('fatura em aberto: a pendente ou vencida mais antiga; paga não conta', async () => {
    const { getPendingInvoiceUrl } = await real()
    const service = {
      getSubscriptionPayments: vi.fn().mockResolvedValue({
        data: [
          { status: 'RECEIVED', dueDate: '2026-08-09', invoiceUrl: 'paga' },
          { status: 'PENDING', dueDate: '2026-10-09', invoiceUrl: 'outubro' },
          { status: 'OVERDUE', dueDate: '2026-09-09', invoiceUrl: 'setembro' },
        ],
      }),
    }
    expect(await getPendingInvoiceUrl(service as never, 'sub_1')).toBe('setembro')
  })

  it('sem fatura em aberto: null', async () => {
    const { getPendingInvoiceUrl } = await real()
    const service = {
      getSubscriptionPayments: vi.fn().mockResolvedValue({ data: [{ status: 'CONFIRMED', dueDate: '2026-10-09', invoiceUrl: 'x' }] }),
    }
    expect(await getPendingInvoiceUrl(service as never, 'sub_1')).toBeNull()
    service.getSubscriptionPayments.mockResolvedValue({})
    expect(await getPendingInvoiceUrl(service as never, 'sub_1')).toBeNull()
  })

  it('assinatura sai como fatura (UNDEFINED), mensal e vencendo hoje por padrão', async () => {
    const { AsaasService } = await real()
    const post = vi.fn().mockResolvedValue({ data: { id: 'sub_1' } })
    const service = Object.assign(Object.create(AsaasService.prototype), { http: { post } })
    await service.createSubscription({ customerId: 'cus_1', value: 39.9 })
    const [url, payload] = post.mock.calls[0]
    expect(url).toBe('/subscriptions')
    expect(payload).toMatchObject({ customer: 'cus_1', value: 39.9, billingType: 'UNDEFINED', cycle: 'MONTHLY' })
    expect(payload.nextDueDate).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
})
