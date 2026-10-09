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
    prestador: { update: vi.fn() },
  }
  m.$transaction = vi.fn(async (fn: (tx: unknown) => unknown) => fn(m))
  return m
})
vi.mock('@/server/db', () => ({ prisma: prismaMock }))

import { cancelarAssinaturas, contratarPlano, trocarPlano } from '@/server/services/assinaturas'
import { assinanteDe } from '@/server/services/assinante'

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
    nome: 'Ana',
    sobrenome: 'Vet',
    userType: 'veterinario',
    veterinario: { id: 'vet-1', subscriptionPlanCode: plano, monthlyAppointmentsUsed: 0 },
  }) as never

const clinica = (plano = 'none') =>
  ({ id: 'u-2', userType: 'clinica', clinica: { id: 'cli-1', subscriptionPlanCode: plano } }) as never

const prestador = (plano = 'free') =>
  ({
    id: 'u-3',
    userType: 'prestador',
    prestador: { id: 'pre-1', subscriptionPlanCode: plano, monthlyAppointmentsUsed: 4 },
  }) as never

const tutor = () => ({ id: 'u-4', userType: 'tutor' }) as never

const PLANO_VET = { id: 'p-1', code: 'vet_starter', name: 'Vet Starter', priceCents: 3990, trialDays: 14, active: 1 }
const PLANO_PEQUENA = { id: 'p-3', code: 'starter', name: 'Pequena', priceCents: 9990, trialDays: 14, active: 1 }
const PLANO_FREE = { id: 'p-4', code: 'free', name: 'Gratuito', priceCents: 0, trialDays: 0, active: 1 }

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

  it('Asaas recusando o cadastro do cliente vira 400 e não cria assinatura', async () => {
    asaas.ensureCustomerForVeterinario.mockRejectedValue(new Error('cpf inválido'))
    await expect(contratarPlano(vet(), 'vet_starter', fabrica)).rejects.toMatchObject({
      status: 400,
      body: { message: expect.stringContaining('CPF/CNPJ') },
    })
    expect(asaas.createSubscription).not.toHaveBeenCalled()
    expect(prismaMock.subscription.create).not.toHaveBeenCalled()
  })

  it('plano inativo (pro_plus legado): 400', async () => {
    prismaMock.subscriptionPlan.findUnique.mockResolvedValue({ ...PLANO_VET, code: 'pro_plus', active: 0 })
    await expect(contratarPlano(vet(), 'pro_plus', fabrica)).rejects.toMatchObject({ status: 400 })
  })

  it('vet não contrata plano de prestador', async () => {
    prismaMock.subscriptionPlan.findUnique.mockResolvedValue({ ...PLANO_VET, code: 'pro', priceCents: 5900 })
    await expect(contratarPlano(vet(), 'pro', fabrica)).rejects.toMatchObject({ status: 400 })
  })

  it('tutor não assina: 403', async () => {
    await expect(contratarPlano(tutor(), 'vet_starter', fabrica)).rejects.toMatchObject({ status: 403 })
  })

  it('clínica contrata a Pequena no teste: cliente da clínica e plano na clínica', async () => {
    prismaMock.subscriptionPlan.findUnique.mockResolvedValue(PLANO_PEQUENA)
    asaas.ensureCustomerForClinica.mockResolvedValue({ id: 'cus_cli' })
    await contratarPlano(clinica(), 'starter', fabrica)

    const enviado = asaas.createSubscription.mock.calls[0][0]
    expect(enviado).toMatchObject({ customerId: 'cus_cli', value: 99.9, externalReference: 'clinica:cli-1' })
    expect(prismaMock.subscription.create.mock.calls[0][0].data).toMatchObject({
      clinicaId: 'cli-1',
      veterinarioId: null,
      status: 'active',
    })
    expect(prismaMock.clinica.update.mock.calls[0][0].data.subscriptionPlanCode).toBe('starter')
  })

  it('a contagem de "já assinou" é por dono e só considera assinaturas do Asaas', async () => {
    await contratarPlano(vet(), 'vet_starter', fabrica)
    expect(prismaMock.subscription.count.mock.calls[0][0].where).toEqual({
      veterinarioId: 'vet-1',
      asaasSubscriptionId: { not: null },
    })
  })

  it('plano gratuito do prestador ativa direto, sem Asaas', async () => {
    prismaMock.subscriptionPlan.findUnique.mockResolvedValue(PLANO_FREE)
    const r = await contratarPlano(prestador('none'), 'free', fabrica)
    expect(asaas.createSubscription).not.toHaveBeenCalled()
    expect(prismaMock.subscription.create.mock.calls[0][0].data).toMatchObject({ prestadorId: 'pre-1', status: 'active' })
    expect(prismaMock.prestador.update.mock.calls[0][0].data.subscriptionPlanCode).toBe('free')
    expect(r).toMatchObject({ checkoutUrl: null, emTeste: false })
  })

  it('sem fatura em aberto ou falha ao buscá-la: pendente com checkoutUrl null', async () => {
    prismaMock.subscription.count.mockResolvedValue(1)
    asaas.getSubscriptionPayments.mockRejectedValue(new Error('timeout'))
    const r = await contratarPlano(vet(), 'vet_starter', fabrica)
    expect(prismaMock.subscription.create.mock.calls[0][0].data.status).toBe('pending')
    expect(r.checkoutUrl).toBeNull()
  })

  it('pendente não tem período nem fim de teste e vence hoje', async () => {
    prismaMock.subscription.count.mockResolvedValue(1)
    const r = await contratarPlano(vet(), 'vet_starter', fabrica)
    const data = prismaMock.subscription.create.mock.calls[0][0].data
    expect(data).toMatchObject({ trialEnd: null, currentPeriodStart: null, currentPeriodEnd: null })
    expect(r.primeiraFatura).toBe(asaas.createSubscription.mock.calls[0][0].nextDueDate)
    expect(Math.abs(new Date(r.primeiraFatura!).getTime() - Date.now())).toBeLessThan(2 * 86_400_000)
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

  it('mesmo plano com assinatura ativa: 400', async () => {
    prismaMock.subscription.findUnique.mockResolvedValue(atual)
    await expect(trocarPlano(vet('vet_starter'), 'sub-1', 'vet_starter', fabrica)).rejects.toMatchObject({ status: 400 })
    expect(asaas.createSubscription).not.toHaveBeenCalled()
  })

  it('mesmo plano com assinatura inadimplente gera nova fatura', async () => {
    prismaMock.subscription.findUnique.mockResolvedValue({ ...atual, status: 'past_due' })
    prismaMock.subscription.count.mockResolvedValue(1)
    await trocarPlano(vet('vet_starter'), 'sub-1', 'vet_starter', fabrica)
    expect(asaas.createSubscription).toHaveBeenCalled()
  })

  it('plano de outro tipo: 400', async () => {
    prismaMock.subscription.findUnique.mockResolvedValue(atual)
    prismaMock.subscriptionPlan.findUnique.mockResolvedValue({ ...PLANO_PEQUENA })
    await expect(trocarPlano(vet('vet_starter'), 'sub-1', 'starter', fabrica)).rejects.toMatchObject({ status: 400 })
  })

  it('assinatura inexistente: 404', async () => {
    prismaMock.subscription.findUnique.mockResolvedValue(null)
    await expect(trocarPlano(vet('vet_starter'), 'sub-x', 'vet_pro', fabrica)).rejects.toMatchObject({ status: 404 })
  })

  it('id de assinatura de uma clínica com o mesmo id do vet: 404', async () => {
    prismaMock.subscription.findUnique.mockResolvedValue({ ...atual, veterinarioId: null, clinicaId: 'vet-1' })
    await expect(trocarPlano(vet('vet_starter'), 'sub-1', 'vet_pro', fabrica)).rejects.toMatchObject({ status: 404 })
  })

  it('nova troca cancela a troca pendente anterior (Asaas e local) antes de criar outra', async () => {
    prismaMock.subscription.findUnique.mockResolvedValue(atual)
    prismaMock.subscription.count.mockResolvedValue(1)
    prismaMock.subscriptionPlan.findUnique.mockResolvedValue({ ...PLANO_VET, id: 'p-2', code: 'vet_pro', priceCents: 5990 })
    prismaMock.subscription.findMany.mockResolvedValue([{ id: 'sub-pend', status: 'pending', asaasSubscriptionId: 'sub_pend' }])
    await trocarPlano(vet('vet_starter'), 'sub-1', 'vet_pro', fabrica)

    expect(asaas.cancelSubscription).toHaveBeenCalledWith('sub_pend')
    expect(prismaMock.subscription.updateMany.mock.calls[0][0]).toMatchObject({
      where: { id: { in: ['sub-pend'] } },
      data: { status: 'canceled' },
    })
    expect(asaas.createSubscription.mock.calls[0][0]).toMatchObject({ customerId: 'cus_1', value: 59.9 })
  })

  it('downgrade (vet_pro para vet_starter) também só vale após o pagamento', async () => {
    prismaMock.subscription.findUnique.mockResolvedValue(atual)
    prismaMock.subscription.count.mockResolvedValue(1)
    const r = await trocarPlano(vet('vet_pro'), 'sub-1', 'vet_starter', fabrica)
    expect(prismaMock.subscription.create.mock.calls[0][0].data.status).toBe('pending')
    expect(prismaMock.veterinario.update).not.toHaveBeenCalled()
    expect(r.message).toMatch(/Conclua o pagamento/)
  })

  it('prestador trocando para o free cancela a assinatura paga e volta ao free', async () => {
    const subPre = { ...atual, veterinarioId: null, prestadorId: 'pre-1', asaasSubscriptionId: 'sub_pre' }
    prismaMock.subscription.findUnique.mockResolvedValue(subPre)
    prismaMock.subscription.findMany.mockResolvedValue([subPre])
    const r = await trocarPlano(prestador('pro'), 'sub-1', 'free', fabrica)
    expect(asaas.cancelSubscription).toHaveBeenCalledWith('sub_pre')
    expect(prismaMock.prestador.update.mock.calls[0][0].data.subscriptionPlanCode).toBe('free')
    expect(r.subscription).toBeNull()
  })
})

describe('cancelar', () => {
  it('sem assinatura aberta: 400', async () => {
    await expect(cancelarAssinaturas(assinanteDe(vet('vet_pro'))!, fabrica)).rejects.toMatchObject({ status: 400 })
  })

  it('cancela todas as abertas no Asaas, marca canceladas e o vet fica sem plano', async () => {
    prismaMock.subscription.findMany.mockResolvedValue([
      { id: 'a', asaasSubscriptionId: 'sub_a', status: 'active' },
      { id: 'b', asaasSubscriptionId: 'sub_b', status: 'pending' },
    ])
    await cancelarAssinaturas(assinanteDe(vet('vet_pro'))!, fabrica)
    expect(asaas.cancelSubscription.mock.calls.map((c) => c[0])).toEqual(['sub_a', 'sub_b'])
    expect(prismaMock.subscription.updateMany.mock.calls[0][0]).toMatchObject({
      where: { id: { in: ['a', 'b'] } },
      data: { status: 'canceled', canceledAt: expect.any(Date) },
    })
    expect(prismaMock.veterinario.update.mock.calls[0][0].data.subscriptionPlanCode).toBe('none')
  })

  it('só procura assinaturas não encerradas do próprio dono', async () => {
    await expect(cancelarAssinaturas(assinanteDe(clinica('clinic'))!, fabrica)).rejects.toMatchObject({ status: 400 })
    expect(prismaMock.subscription.findMany.mock.calls[0][0].where).toEqual({
      clinicaId: 'cli-1',
      status: { notIn: ['canceled', 'expired'] },
    })
  })

  it('falha no Asaas não impede o cancelamento local', async () => {
    prismaMock.subscription.findMany.mockResolvedValue([{ id: 'a', asaasSubscriptionId: 'sub_a', status: 'active' }])
    asaas.cancelSubscription.mockRejectedValueOnce(new Error('500'))
    await cancelarAssinaturas(assinanteDe(vet('vet_pro'))!, fabrica)
    expect(prismaMock.subscription.updateMany).toHaveBeenCalled()
    expect(prismaMock.veterinario.update).toHaveBeenCalled()
  })

  it('assinatura sem Asaas (plano gratuito) não chama o Asaas', async () => {
    const fabricaEspia = vi.fn(fabrica)
    prismaMock.subscription.findMany.mockResolvedValue([{ id: 'a', asaasSubscriptionId: null, status: 'active' }])
    await cancelarAssinaturas(assinanteDe(prestador('free'))!, fabricaEspia)
    expect(fabricaEspia).not.toHaveBeenCalled()
    expect(prismaMock.prestador.update).not.toHaveBeenCalled()
  })

  it('cancelar não zera o contador mensal do vet', async () => {
    prismaMock.subscription.findMany.mockResolvedValue([{ id: 'a', asaasSubscriptionId: 'sub_a', status: 'active' }])
    await cancelarAssinaturas(assinanteDe(vet('vet_pro'))!, fabrica)
    expect(prismaMock.veterinario.update.mock.calls[0][0].data).not.toHaveProperty('monthlyAppointmentsUsed')
  })
})

describe('assinaturas: mensagens, filtros e dados enviados', () => {
  const atual = { id: 'sub-1', veterinarioId: 'vet-1', clinicaId: null, prestadorId: null, status: 'active', asaasCustomerId: 'cus_1' }
  const mensagem = (p: Promise<unknown>) => p.catch((e) => e.body?.message)

  it('mensagens de erro de contratação', async () => {
    expect(await mensagem(contratarPlano(tutor(), 'vet_starter', fabrica))).toBe(
      'Apenas veterinários, clínicas e profissionais podem assinar'
    )
    expect(await mensagem(contratarPlano(vet(), '', fabrica))).toBe('planCode é obrigatório')
    prismaMock.subscriptionPlan.findUnique.mockResolvedValueOnce(null)
    expect(await mensagem(contratarPlano(vet(), 'xpto', fabrica))).toBe('Plano inválido')
    prismaMock.subscription.findFirst.mockResolvedValueOnce({ id: 'sub-x' })
    expect(await mensagem(contratarPlano(vet(), 'vet_starter', fabrica))).toBe(
      'Você já possui uma assinatura ativa ou pendente. Use a opção de alterar plano.'
    )
  })

  it('planCode que não é texto é recusado antes de consultar o plano', async () => {
    expect(await mensagem(contratarPlano(vet(), 123, fabrica))).toBe('planCode é obrigatório')
    expect(prismaMock.subscriptionPlan.findUnique).not.toHaveBeenCalled()
  })

  it('consulta o plano pelo código e a assinatura aberta do dono', async () => {
    await contratarPlano(vet(), 'vet_starter', fabrica)
    expect(prismaMock.subscriptionPlan.findUnique).toHaveBeenCalledWith({ where: { code: 'vet_starter' } })
    expect(prismaMock.subscription.findFirst).toHaveBeenCalledWith({
      where: { veterinarioId: 'vet-1', status: { in: ['active', 'pending'] } },
    })
  })

  it('envia descrição e referência do dono ao Asaas e grava billingType UNDEFINED', async () => {
    await contratarPlano(vet(), 'vet_starter', fabrica)
    expect(asaas.createSubscription.mock.calls[0][0]).toMatchObject({
      customerId: 'cus_1',
      description: 'Assinatura Lince Pet Vet Starter',
      externalReference: 'vet:vet-1',
    })
    expect(prismaMock.subscription.create.mock.calls[0][0].data.billingType).toBe('UNDEFINED')
  })

  it('cancelar sem abertas explica o motivo', async () => {
    expect(await mensagem(cancelarAssinaturas(assinanteDe(vet('vet_pro'))!, fabrica))).toBe(
      'Nenhuma assinatura ativa encontrada.'
    )
  })

  it('cancelar mistura: só as que têm id no Asaas são canceladas lá', async () => {
    prismaMock.subscription.findMany.mockResolvedValue([
      { id: 's-1', asaasSubscriptionId: 'sub_a' },
      { id: 's-2', asaasSubscriptionId: null },
    ])
    await cancelarAssinaturas(assinanteDe(vet('vet_pro'))!, fabrica)
    expect(asaas.cancelSubscription).toHaveBeenCalledTimes(1)
    expect(asaas.cancelSubscription).toHaveBeenCalledWith('sub_a')
    expect(prismaMock.subscription.updateMany.mock.calls[0][0].where).toEqual({ id: { in: ['s-1', 's-2'] } })
  })

  it('cancelar loga a falha do Asaas', async () => {
    const erro = vi.spyOn(console, 'error').mockImplementation(() => {})
    prismaMock.subscription.findMany.mockResolvedValue([{ id: 's-1', asaasSubscriptionId: 'sub_a' }])
    asaas.cancelSubscription.mockRejectedValueOnce(new Error('500'))
    await cancelarAssinaturas(assinanteDe(vet('vet_pro'))!, fabrica)
    expect(erro).toHaveBeenCalledWith(expect.stringContaining('cancelar'), expect.any(Error))
    erro.mockRestore()
  })

  it('trocar: mensagens de erro', async () => {
    expect(await mensagem(trocarPlano(vet('vet_starter'), 'sub-1', '', fabrica))).toBe('planCode é obrigatório')
    prismaMock.subscription.findUnique.mockResolvedValueOnce(null)
    expect(await mensagem(trocarPlano(vet('vet_starter'), 'sub-1', 'vet_pro', fabrica))).toBe('Assinatura não encontrada')
    prismaMock.subscription.findUnique.mockResolvedValueOnce(atual)
    expect(await mensagem(trocarPlano(vet('vet_starter'), 'sub-1', 'vet_starter', fabrica))).toBe(
      'Este já é o seu plano atual.'
    )
    expect(prismaMock.subscription.findUnique).toHaveBeenCalledWith({ where: { id: 'sub-1' } })
  })

  it('trocar: assinatura sem dono responde 404', async () => {
    prismaMock.subscription.findUnique.mockResolvedValue({ ...atual, veterinarioId: null })
    await expect(trocarPlano(vet('vet_starter'), 'sub-1', 'vet_pro', fabrica)).rejects.toMatchObject({ status: 404 })
  })

  it('trocar para none cancela sem consultar plano, mesmo para o prestador', async () => {
    prismaMock.subscription.findUnique.mockResolvedValue({ ...atual, veterinarioId: null, prestadorId: 'pre-1' })
    prismaMock.subscription.findMany.mockResolvedValue([{ id: 'sub-1', asaasSubscriptionId: null }])
    const r = await trocarPlano(prestador('pro'), 'sub-1', 'none', fabrica)
    expect(r).toEqual({ message: 'Assinatura cancelada.', subscription: null, checkoutUrl: null, emTeste: false, primeiraFatura: null })
    expect(prismaMock.subscriptionPlan.findUnique).not.toHaveBeenCalled()
  })

  it('trocar sem pendentes não cancela nada e filtra as pendentes do dono', async () => {
    prismaMock.subscription.findUnique.mockResolvedValue(atual)
    prismaMock.subscriptionPlan.findUnique.mockResolvedValue({ ...PLANO_VET, id: 'p-2', code: 'vet_pro', priceCents: 5990 })
    await trocarPlano(vet('vet_starter'), 'sub-1', 'vet_pro', fabrica)
    expect(prismaMock.subscription.findMany).toHaveBeenCalledWith({ where: { veterinarioId: 'vet-1', status: 'pending' } })
    expect(prismaMock.subscription.updateMany).not.toHaveBeenCalled()
    expect(asaas.cancelSubscription).not.toHaveBeenCalled()
  })
})
