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
  prismaMock.asaasCancelamento.findFirst.mockResolvedValue(null)
  prismaMock.asaasCancelamento.count.mockResolvedValue(0)
  conciliacao.conciliarCancelamentos.mockResolvedValue({ confirmados: 1, pendentes: 0 })
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

  it('none persiste o cancelamento antes de pedir conciliação', async () => {
    prismaMock.subscription.findUnique.mockResolvedValue(atual)
    prismaMock.subscription.findMany.mockResolvedValue([{ ...atual, asaasSubscriptionId: 'sub_asaas_1' }])
    const r = await trocarPlano(vet('vet_starter'), 'sub-1', 'none', fabrica)
    expect(prismaMock.asaasCancelamento.upsert).toHaveBeenCalledWith(expect.objectContaining({ create: { subscriptionId: 'sub-1', motivo: 'usuario' } }))
    expect(conciliacao.conciliarCancelamentos).toHaveBeenCalledWith(fabrica, ['sub-1'])
    expect(r).toMatchObject({ cancelamentoPendente: false })
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

  it('nova troca concilia a fatura pendente anterior antes de criar outra', async () => {
    prismaMock.subscription.findUnique.mockResolvedValue(atual)
    prismaMock.subscription.count.mockResolvedValue(1)
    prismaMock.subscriptionPlan.findUnique.mockResolvedValue({ ...PLANO_VET, id: 'p-2', code: 'vet_pro', priceCents: 5990 })
    prismaMock.subscription.findMany.mockResolvedValue([{ id: 'sub-pend', status: 'pending', asaasSubscriptionId: 'sub_pend' }])
    await trocarPlano(vet('vet_starter'), 'sub-1', 'vet_pro', fabrica)
    expect(prismaMock.asaasCancelamento.upsert).toHaveBeenCalledWith(expect.objectContaining({ create: { subscriptionId: 'sub-pend', motivo: 'troca' } }))
    expect(conciliacao.conciliarCancelamentos.mock.invocationCallOrder[0]).toBeLessThan(asaas.createSubscription.mock.invocationCallOrder[0])
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

  it('prestador trocando para free solicita cancelamento da assinatura paga', async () => {
    const subPre = { ...atual, veterinarioId: null, prestadorId: 'pre-1', asaasSubscriptionId: 'sub_pre' }
    prismaMock.subscription.findUnique.mockResolvedValue(subPre)
    prismaMock.subscription.findMany.mockResolvedValue([subPre])
    const r = await trocarPlano(prestador('pro'), 'sub-1', 'free', fabrica)
    expect(prismaMock.asaasCancelamento.upsert).toHaveBeenCalledWith(expect.objectContaining({ create: { subscriptionId: 'sub-1', motivo: 'usuario' } }))
    expect(r.subscription).toBeNull()
  })
})

describe('cancelar', () => {
  it('sem assinatura aberta: 400', async () => {
    await expect(cancelarAssinaturas(assinanteDe(vet('vet_pro'))!, fabrica)).rejects.toMatchObject({ status: 400 })
  })
  it('grava todos os pedidos antes de chamar o provedor e não altera o plano diretamente', async () => {
    prismaMock.subscription.findMany.mockResolvedValue([{ id: 'a' }, { id: 'b' }])
    await expect(cancelarAssinaturas(assinanteDe(vet('vet_pro'))!, fabrica)).resolves.toMatchObject({ cancelamentoPendente: false })
    expect(prismaMock.asaasCancelamento.upsert).toHaveBeenCalledTimes(2)
    expect(prismaMock.asaasCancelamento.upsert.mock.invocationCallOrder[1]).toBeLessThan(conciliacao.conciliarCancelamentos.mock.invocationCallOrder[0])
    expect(prismaMock.veterinario.update).not.toHaveBeenCalled()
    expect(prismaMock.subscription.updateMany).not.toHaveBeenCalled()
    expect(prismaMock.$executeRaw).toHaveBeenCalled()
  })
  it('só procura assinaturas não encerradas do próprio dono', async () => {
    await expect(cancelarAssinaturas(assinanteDe(clinica('clinic'))!, fabrica)).rejects.toMatchObject({ status: 400 })
    expect(prismaMock.subscription.findMany.mock.calls[0][0].where).toEqual({ clinicaId: 'cli-1', status: { notIn: ['canceled', 'expired'] } })
  })
  it('sem confirmação mantém pendência explícita e nunca anuncia sucesso', async () => {
    prismaMock.subscription.findMany.mockResolvedValue([{ id: 'a' }])
    prismaMock.asaasCancelamento.count.mockResolvedValue(1)
    const r = await cancelarAssinaturas(assinanteDe(vet('vet_pro'))!, fabrica)
    expect(r.cancelamentoPendente).toBe(true)
    expect(r.message).toMatch(/aguarda confirmação/)
    expect(r.message).not.toMatch(/sucesso/)
    expect(prismaMock.veterinario.update).not.toHaveBeenCalled()
    expect(prismaMock.subscription.updateMany).not.toHaveBeenCalled()
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

  it('mistura assinaturas gratuitas e pagas na mesma conciliação', async () => {
    prismaMock.subscription.findMany.mockResolvedValue([{ id: 's-1', asaasSubscriptionId: 'sub_a' }, { id: 's-2', asaasSubscriptionId: null }])
    await cancelarAssinaturas(assinanteDe(vet('vet_pro'))!, fabrica)
    expect(conciliacao.conciliarCancelamentos).toHaveBeenCalledWith(fabrica, ['s-1', 's-2'])
  })

  it('não cria outra assinatura enquanto existir cancelamento pendente', async () => {
    prismaMock.asaasCancelamento.findFirst.mockResolvedValue({ subscriptionId: 's-1' })
    await expect(contratarPlano(vet(), 'vet_starter', fabrica)).rejects.toMatchObject({ status: 409 })
    expect(asaas.createSubscription).not.toHaveBeenCalled()
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
    expect(r).toEqual({ cancelamentoPendente: false, message: 'Assinatura cancelada com sucesso.', subscription: null, checkoutUrl: null, emTeste: false, primeiraFatura: null })
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
