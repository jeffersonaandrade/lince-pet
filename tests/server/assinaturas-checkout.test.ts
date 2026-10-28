import { beforeEach, describe, expect, it, vi } from 'vitest'
const db = vi.hoisted(() => ({ subscription: { findMany: vi.fn(), findFirst: vi.fn() }, asaasCancelamento: { findFirst: vi.fn() } }))
vi.mock('@/server/db', () => ({ prisma: db }))
import { prepararCheckout } from '@/server/services/assinaturas-checkout'
import type { CurrentUser } from '@/server/auth/session'
import type { AsaasFactory } from '@/server/services/assinaturas'
const asaas = { getSubscriptionPayments: vi.fn(), configurarRetornoPagamento: vi.fn() }
const factory = vi.fn(() => asaas) as unknown as AsaasFactory
const user = { userType: 'veterinario', veterinario: { id: 'vet-titular', subscriptionPlanCode: 'free' } } as CurrentUser
const sub = { id: 'local', status: 'pending', asaasSubscriptionId: 'sub_titular' }
const fatura = { id: 'pay_1', status: 'PENDING', dueDate: '2026-10-27', invoiceUrl: 'https://asaas.com/i/teste' }
beforeEach(() => {
  vi.clearAllMocks()
  db.subscription.findMany.mockResolvedValue([sub])
  db.subscription.findFirst.mockResolvedValue(sub)
  db.asaasCancelamento.findFirst.mockResolvedValue(null)
  asaas.getSubscriptionPayments.mockResolvedValue({ data: [fatura] })
  asaas.configurarRetornoPagamento.mockResolvedValue(undefined)
})
describe('preparar fatura do titular', () => {
  it('filtra pelo dono e ajusta só o retorno da fatura existente', async () => {
    expect(await prepararCheckout(user, factory)).toEqual({ checkoutUrl: 'https://asaas.com/i/teste?autoRedirect=true' })
    expect(db.subscription.findMany.mock.calls[0][0].where.veterinarioId).toBe('vet-titular')
    expect(asaas.getSubscriptionPayments).toHaveBeenCalledWith('sub_titular')
    expect(asaas.configurarRetornoPagamento).toHaveBeenCalledWith('pay_1')
    expect(db.subscription.findFirst.mock.calls[0][0].where).toMatchObject({id:'local',veterinarioId:'vet-titular'})
  })
  it('recusa perfil sem assinatura', async () => {
    await expect(prepararCheckout({} as CurrentUser, factory)).rejects.toMatchObject({status:403})
    expect(db.subscription.findMany).not.toHaveBeenCalled()
  })
  it('não permite retomar fatura durante cancelamento', async () => {
    db.asaasCancelamento.findFirst.mockResolvedValue({subscriptionId:'local'})
    await expect(prepararCheckout(user, factory)).rejects.toMatchObject({status:409})
    expect(asaas.getSubscriptionPayments).not.toHaveBeenCalled()
  })
  it.each([{subs:[]}, {subs:[{...sub,asaasSubscriptionId:null}]}])('sem assinatura pagável retorna à situação do plano', async ({subs}) => {
    db.subscription.findMany.mockResolvedValue(subs)
    expect(await prepararCheckout(user,factory)).toEqual({checkoutUrl:null})
    expect(asaas.getSubscriptionPayments).not.toHaveBeenCalled()
  })
  it('prioriza a troca pendente sobre uma assinatura vencida', async () => {
    db.subscription.findMany.mockResolvedValue([{...sub,status:'past_due',asaasSubscriptionId:'sub_vencida'},sub])
    await prepararCheckout(user,factory)
    expect(asaas.getSubscriptionPayments).toHaveBeenCalledWith('sub_titular')
  })
  it('permite regularizar assinatura vencida', async () => {
    db.subscription.findMany.mockResolvedValue([{...sub,status:'past_due'}])
    expect((await prepararCheckout(user,factory)).checkoutUrl).toContain('asaas.com')
  })
  it('ignora pagamentos quitados e escolhe o vencimento aberto mais antigo', async () => {
    asaas.getSubscriptionPayments.mockResolvedValue({data:[{...fatura,id:'pay_3',status:'RECEIVED'}, {...fatura,id:'pay_2',dueDate:'2026-11-01'}, {...fatura,status:'OVERDUE'}]})
    await prepararCheckout(user,factory)
    expect(asaas.configurarRetornoPagamento).toHaveBeenCalledWith('pay_1')
  })
  it.each([{data:[]},{}])('sem fatura aberta não encaminha para cobrança antiga', async dados => {
    asaas.getSubscriptionPayments.mockResolvedValue(dados)
    expect(await prepararCheckout(user,factory)).toEqual({checkoutUrl:null})
    expect(asaas.configurarRetornoPagamento).not.toHaveBeenCalled()
  })
  it.each([{...fatura,invoiceUrl:'https://evil.test'}, {...fatura,id:'../outro'}])('recusa resposta inválida do provedor', async pagamento => {
    asaas.getSubscriptionPayments.mockResolvedValue({data:[pagamento]})
    await expect(prepararCheckout(user,factory)).rejects.toMatchObject({status:502})
    expect(asaas.configurarRetornoPagamento).not.toHaveBeenCalled()
  })
  it('se a assinatura mudar durante a preparação, consulta a situação', async () => {
    db.subscription.findFirst.mockResolvedValue(null)
    expect(await prepararCheckout(user,factory)).toEqual({checkoutUrl:null})
  })
  it.each(['getSubscriptionPayments','configurarRetornoPagamento'] as const)('erro em %s não expõe credenciais nem cria pagamento', async metodo => {
    const log = vi.spyOn(console,'error').mockImplementation(()=>{})
    asaas[metodo].mockRejectedValueOnce({response:{status:503},config:{access_token:'SEGREDO'}})
    await expect(prepararCheckout(user,factory)).rejects.toMatchObject({status:502})
    expect(JSON.stringify(log.mock.calls)).not.toContain('SEGREDO')
    log.mockRestore()
  })
})
