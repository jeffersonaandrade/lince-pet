import { describe, it, expect, vi, beforeEach } from 'vitest'

const prismaMock = vi.hoisted(() => {
  const m = {
    $executeRaw: vi.fn(),
    asaasCancelamento: { findFirst: vi.fn(), count: vi.fn(), upsert: vi.fn() },
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
    prestador: { update: vi.fn() },
  }
  return Object.assign(m, { $transaction: vi.fn(async (fn: (tx: unknown) => unknown) => fn(m)) })
})
vi.mock('@/server/db', () => ({ prisma: prismaMock }))
const conciliacao = vi.hoisted(() => ({ conciliarCancelamentos: vi.fn() }))
vi.mock('@/server/services/asaas-cancelamentos', async importOriginal => ({
  ...await importOriginal<typeof import('@/server/services/asaas-cancelamentos')>(), ...conciliacao,
}))

import { contratarPlano, trocarPlano } from '@/server/services/assinaturas'

const asaas = {
  ensureCustomerForVeterinario: vi.fn(),
  ensureCustomerForClinica: vi.fn(),
  ensureCustomerForPrestador: vi.fn(),
  createSubscription: vi.fn(),
  getSubscriptionPayments: vi.fn(),
  cancelSubscription: vi.fn(),
}
const fabrica = () => asaas as never

const vet = (plano = 'none') =>
  ({
    id: 'u-1',
    userType: 'veterinario',
    veterinario: { id: 'vet-1', subscriptionPlanCode: plano, monthlyAppointmentsUsed: 0 },
  }) as never

const prestador = (plano = 'free') =>
  ({ id: 'u-3', userType: 'prestador', prestador: { id: 'pre-1', subscriptionPlanCode: plano, monthlyAppointmentsUsed: 4 } }) as never

const PLANO_VET = { id: 'p-1', code: 'vet_pro', name: 'Vet Pro', priceCents: 5990, trialDays: 14, active: 1 }
const PLANO_PRO_PRESTADOR = { id: 'p-5', code: 'pro', name: 'Pro', priceCents: 2990, trialDays: 14, active: 1 }
const atual = { id: 'sub-1', veterinarioId: 'vet-1', clinicaId: null, prestadorId: null, status: 'active', asaasCustomerId: 'cus_1' }

beforeEach(() => {
  vi.clearAllMocks()
  prismaMock.asaasCancelamento.findFirst.mockResolvedValue(null)
  prismaMock.asaasCancelamento.count.mockResolvedValue(0)
  conciliacao.conciliarCancelamentos.mockResolvedValue({ confirmados: 1, pendentes: 0 })
  vi.spyOn(console, 'error').mockImplementation(() => {})
  prismaMock.subscriptionPlan.findUnique.mockResolvedValue(PLANO_VET)
  prismaMock.subscription.findFirst.mockResolvedValue(null)
  prismaMock.subscription.findUnique.mockResolvedValue(atual)
  prismaMock.subscription.findMany.mockResolvedValue([])
  prismaMock.subscription.count.mockResolvedValue(1)
  asaas.ensureCustomerForVeterinario.mockResolvedValue({ id: 'cus_1' })
  asaas.ensureCustomerForPrestador.mockResolvedValue({ id: 'cus_pre' })
  asaas.createSubscription.mockResolvedValue({ id: 'sub_asaas_1' })
  asaas.cancelSubscription.mockResolvedValue({})
  asaas.getSubscriptionPayments.mockResolvedValue({ data: [] })
})

describe('erros do Asaas com detalhes da resposta', () => {
  it('cliente recusado: loga response.data do Asaas e devolve 400', async () => {
    const erro = { response: { data: { errors: [{ description: 'CPF inválido' }] } } }
    asaas.ensureCustomerForVeterinario.mockRejectedValueOnce(erro)
    await expect(contratarPlano(vet(), 'vet_pro', fabrica)).rejects.toMatchObject({ status: 400 })
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining('cliente'), { codigo: 'ERRO_INTEGRACAO' })
  })

  it('assinatura recusada: loga response.data do Asaas e devolve 400 sem gravar', async () => {
    const erro = { response: { data: { errors: [{ description: 'valor mínimo' }] } } }
    asaas.createSubscription.mockRejectedValueOnce(erro)
    await expect(contratarPlano(vet(), 'vet_pro', fabrica)).rejects.toMatchObject({
      status: 400,
      body: { message: expect.stringContaining('recusou a criação') },
    })
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining('assinatura'), { codigo: 'ERRO_INTEGRACAO' })
    expect(prismaMock.subscription.create).not.toHaveBeenCalled()
  })
})

describe('trocarPlano: casos extras', () => {
  it('prestador sem assinatura paga anterior troca para pro pendente, sem teste', async () => {
    const subPre = { ...atual, veterinarioId: null, prestadorId: 'pre-1', asaasCustomerId: null }
    prismaMock.subscription.findUnique.mockResolvedValueOnce(subPre)
    prismaMock.subscription.count.mockResolvedValueOnce(0)
    prismaMock.subscriptionPlan.findUnique.mockResolvedValueOnce(PLANO_PRO_PRESTADOR)

    const r = await trocarPlano(prestador('free'), 'sub-1', 'pro', fabrica)

    expect(asaas.ensureCustomerForPrestador).toHaveBeenCalled()
    expect(asaas.createSubscription.mock.calls[0][0]).toMatchObject({ customerId: 'cus_pre', externalReference: 'prestador:pre-1' })
    expect(prismaMock.prestador.update).not.toHaveBeenCalled()
    expect(r).toMatchObject({ emTeste: false, message: 'Conclua o pagamento da fatura para ativar o novo plano.' })
  })

  it('plano gratuito que não é o padrão do dono também solicita cancelamento', async () => {
    prismaMock.subscriptionPlan.findUnique.mockResolvedValueOnce({ ...PLANO_VET, priceCents: 0 })
    prismaMock.subscription.findMany.mockResolvedValueOnce([{ ...atual, asaasSubscriptionId: 'sub_a' }])
    const r = await trocarPlano(vet('vet_starter'), 'sub-1', 'vet_pro', fabrica)
    expect(r).toMatchObject({ cancelamentoPendente: false, subscription: null })
    expect(prismaMock.asaasCancelamento.upsert).toHaveBeenCalled()
    expect(asaas.createSubscription).not.toHaveBeenCalled()
  })

  it('cancelamento anterior não confirmado impede nova cobrança e preserva plano', async () => {
    prismaMock.subscription.findMany.mockResolvedValueOnce([{ id: 'pend-1', status: 'pending', asaasSubscriptionId: 'sub_p1' }])
    prismaMock.asaasCancelamento.findFirst.mockResolvedValueOnce(null).mockResolvedValueOnce({ subscriptionId: 'pend-1' })
    await expect(trocarPlano(vet('vet_starter'), 'sub-1', 'vet_pro', fabrica)).rejects.toMatchObject({ status: 409 })
    expect(prismaMock.asaasCancelamento.upsert).toHaveBeenCalled()
    expect(asaas.createSubscription).not.toHaveBeenCalled()
    expect(prismaMock.veterinario.update).not.toHaveBeenCalled()
  })

  it('tutor não troca plano: 403', async () => {
    await expect(trocarPlano({ id: 'u', userType: 'tutor' } as never, 'sub-1', 'vet_pro', fabrica)).rejects.toMatchObject({ status: 403 })
  })

  it('planCode não-string: 400 sem consultar a assinatura', async () => {
    await expect(trocarPlano(vet('vet_pro'), 'sub-1', 42, fabrica)).rejects.toMatchObject({ status: 400 })
    expect(prismaMock.subscription.findUnique).not.toHaveBeenCalled()
  })
})
