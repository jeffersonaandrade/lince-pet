import { describe, it, expect, vi, beforeEach } from 'vitest'

const prismaMock = vi.hoisted(() => {
  const m: any = {
    subscriptionPlan: { findUnique: vi.fn() },
    subscription: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      updateMany: vi.fn(),
    },
    veterinario: { update: vi.fn() },
    clinica: { update: vi.fn() },
  }
  m.$transaction = vi.fn(async (fn: (tx: unknown) => unknown) => fn(m))
  return m
})
vi.mock('@/server/db', () => ({ prisma: prismaMock }))

import { cancelarAssinaturas, contratarPlano, trocarPlano } from '@/server/services/assinaturas'
import { assinanteDe } from '@/server/services/assinante'

const asaas = {
  ensureCustomerForVeterinario: vi.fn(),
  createSubscription: vi.fn(),
  getSubscriptionPayments: vi.fn(),
  cancelSubscription: vi.fn(),
}
const fabrica = () => asaas as never

const vet = (plano = 'none') =>
  ({
    id: 'u-1',
    nome: 'Ana',
    sobrenome: 'Vet',
    userType: 'veterinario',
    veterinario: { id: 'vet-1', subscriptionPlanCode: plano, monthlyAppointmentsUsed: 0 },
  }) as never

const PLANO_VET = { id: 'p-1', code: 'vet_starter', name: 'Vet Starter', priceCents: 3990, trialDays: 14, active: 1 }

beforeEach(() => {
  vi.clearAllMocks()
  prismaMock.subscriptionPlan.findUnique.mockResolvedValue(PLANO_VET)
  prismaMock.subscription.findFirst.mockResolvedValue(null)
  prismaMock.subscription.findMany.mockResolvedValue([])
  prismaMock.subscription.count.mockResolvedValue(0)
  asaas.ensureCustomerForVeterinario.mockResolvedValue({ id: 'cus_1' })
  asaas.createSubscription.mockResolvedValue({ id: 'sub_asaas_1' })
  asaas.getSubscriptionPayments.mockResolvedValue({
    data: [{ status: 'PENDING', dueDate: '2026-10-09', invoiceUrl: 'https://asaas/i/1' }],
  })
})

describe('contratar plano', () => {
  it('primeira assinatura: teste de 14 dias, plano já aplicado e fatura no fim do teste', async () => {
    const r = await contratarPlano(vet(), 'vet_starter', fabrica)

    const enviado = asaas.createSubscription.mock.calls[0][0]
    expect(enviado.billingType).toBe('UNDEFINED')
    expect(enviado.value).toBe(39.9)
    expect(enviado.cycle).toBe('MONTHLY')
    const dias = Math.round((new Date(enviado.nextDueDate).getTime() - new Date(r.primeiraFatura!).getTime()) / 86_400_000)
    expect(dias).toBe(0)
    expect(new Date(enviado.nextDueDate).getTime()).toBeGreaterThan(Date.now() + 12 * 86_400_000)

    expect(prismaMock.subscription.create.mock.calls[0][0].data.status).toBe('active')
    expect(prismaMock.subscription.create.mock.calls[0][0].data.trialEnd).toBeInstanceOf(Date)
    expect(prismaMock.veterinario.update.mock.calls[0][0].data.subscriptionPlanCode).toBe('vet_starter')
    expect(r).toMatchObject({ emTeste: true, checkoutUrl: null })
  })

  it('quem já assinou antes não tem teste: fica pendente e o plano não muda', async () => {
    prismaMock.subscription.count.mockResolvedValue(1)
    const r = await contratarPlano(vet(), 'vet_starter', fabrica)
    expect(prismaMock.subscription.create.mock.calls[0][0].data.status).toBe('pending')
    expect(prismaMock.veterinario.update).not.toHaveBeenCalled()
    expect(r).toMatchObject({ emTeste: false, checkoutUrl: 'https://asaas/i/1' })
  })

  it('sem planCode, plano inexistente ou de outro tipo: 400', async () => {
    await expect(contratarPlano(vet(), undefined, fabrica)).rejects.toMatchObject({ status: 400 })
    prismaMock.subscriptionPlan.findUnique.mockResolvedValue(null)
    await expect(contratarPlano(vet(), 'xpto', fabrica)).rejects.toMatchObject({ status: 400 })
    prismaMock.subscriptionPlan.findUnique.mockResolvedValue({ ...PLANO_VET, code: 'clinic' })
    await expect(contratarPlano(vet(), 'clinic', fabrica)).rejects.toMatchObject({ status: 400 })
    expect(asaas.createSubscription).not.toHaveBeenCalled()
  })

  it('com assinatura ativa ou pendente: 400', async () => {
    prismaMock.subscription.findFirst.mockResolvedValue({ id: 's', status: 'active' })
    await expect(contratarPlano(vet(), 'vet_starter', fabrica)).rejects.toMatchObject({ status: 400 })
  })

  it('Asaas recusando a assinatura vira 400 sem gravar nada', async () => {
    asaas.createSubscription.mockRejectedValue(new Error('boom'))
    await expect(contratarPlano(vet(), 'vet_starter', fabrica)).rejects.toMatchObject({ status: 400 })
    expect(prismaMock.subscription.create).not.toHaveBeenCalled()
  })
})

describe('trocar plano', () => {
  const atual = { id: 'sub-1', veterinarioId: 'vet-1', clinicaId: null, prestadorId: null, status: 'active', asaasCustomerId: 'cus_1' }

  it('sem planCode: 400', async () => {
    await expect(trocarPlano(vet('vet_starter'), 'sub-1', undefined, fabrica)).rejects.toMatchObject({ status: 400 })
  })

  it('assinatura de outro dono: 404', async () => {
    prismaMock.subscription.findUnique.mockResolvedValue({ ...atual, veterinarioId: 'vet-2' })
    await expect(trocarPlano(vet('vet_starter'), 'sub-1', 'vet_pro', fabrica)).rejects.toMatchObject({ status: 404 })
  })

  it('upgrade cria pendente sem teste e mantém o plano atual até o pagamento', async () => {
    prismaMock.subscription.findUnique.mockResolvedValue(atual)
    prismaMock.subscription.count.mockResolvedValue(1)
    prismaMock.subscriptionPlan.findUnique.mockResolvedValue({ ...PLANO_VET, id: 'p-2', code: 'vet_pro', priceCents: 5990 })
    const r = await trocarPlano(vet('vet_starter'), 'sub-1', 'vet_pro', fabrica)
    expect(asaas.ensureCustomerForVeterinario).not.toHaveBeenCalled()
    expect(prismaMock.subscription.create.mock.calls[0][0].data.status).toBe('pending')
    expect(prismaMock.veterinario.update).not.toHaveBeenCalled()
    expect(r.checkoutUrl).toBe('https://asaas/i/1')
  })

  it('none cancela tudo no Asaas e o vet fica sem plano', async () => {
    prismaMock.subscription.findUnique.mockResolvedValue(atual)
    prismaMock.subscription.findMany.mockResolvedValue([{ ...atual, asaasSubscriptionId: 'sub_asaas_1' }])
    await trocarPlano(vet('vet_starter'), 'sub-1', 'none', fabrica)
    expect(asaas.cancelSubscription).toHaveBeenCalledWith('sub_asaas_1')
    expect(prismaMock.subscription.updateMany.mock.calls[0][0].data.status).toBe('canceled')
    expect(prismaMock.veterinario.update.mock.calls[0][0].data.subscriptionPlanCode).toBe('none')
  })
})

describe('cancelar', () => {
  it('sem assinatura aberta: 400', async () => {
    await expect(cancelarAssinaturas(assinanteDe(vet('vet_pro'))!, fabrica)).rejects.toMatchObject({ status: 400 })
  })
})
