import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const http = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() }))
const createMock = vi.hoisted(() => vi.fn(() => http))
vi.mock('axios', () => ({ default: { create: createMock } }))

import { AsaasService, getCheckoutUrl, getPendingInvoiceUrl } from '@/server/services/asaas'
import AsaasDefault from '@/server/services/asaas'
import { dataLocal } from '@/server/services/assinatura-regras'

const ENVS = [
  'ASAAS_ENV',
  'ASAAS_BASE_URL',
  'ASAAS_BASE_URL_SANDBOX',
  'ASAAS_BASE_URL_PROD',
  'ASAAS_API_KEY',
  'ASAAS_API_KEY_PROD',
  'ASAAS_API_KEY_SANDBOX',
]

const lista = (...itens: unknown[]) => ({ data: { data: itens } })
const USER = { nome: 'Ana', sobrenome: 'Lima', email: 'ana@x.com', celular: '81999990000' }

beforeEach(() => {
  vi.clearAllMocks()
  for (const k of [...Object.values(http)]) k.mockReset()
  for (const name of ENVS) vi.stubEnv(name, '')
  vi.stubEnv('ASAAS_API_KEY_SANDBOX', 'sand-key-123456')
  vi.spyOn(console, 'info').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

const configDoCreate = () => (createMock.mock.calls.at(-1) as unknown as [any])[0]

describe('AsaasService: configuração', () => {
  it('padrão sandbox com a chave de sandbox e timeout de 15s', () => {
    new AsaasService()
    expect(configDoCreate()).toEqual({
      baseURL: 'https://sandbox.asaas.com/api/v3',
      headers: { 'Content-Type': 'application/json', access_token: 'sand-key-123456' },
      timeout: 15000,
    })
    expect(console.info).toHaveBeenCalledWith(expect.stringContaining('key=sand...3456'))
    expect(console.info).not.toHaveBeenCalledWith(expect.stringContaining('sand-key-123456'))
  })

  it('produção usa a chave e a URL de produção', () => {
    vi.stubEnv('ASAAS_ENV', 'production')
    vi.stubEnv('ASAAS_API_KEY_PROD', 'prod-key-abcdef')
    new AsaasService()
    expect(configDoCreate().baseURL).toBe('https://www.asaas.com/api/v3')
    expect(configDoCreate().headers.access_token).toBe('prod-key-abcdef')
  })

  it('produção sem chave própria cai na chave genérica e na URL genérica', () => {
    vi.stubEnv('ASAAS_ENV', 'production')
    vi.stubEnv('ASAAS_API_KEY', 'generica-999999')
    vi.stubEnv('ASAAS_BASE_URL', 'https://asaas.local/api')
    new AsaasService()
    expect(configDoCreate().baseURL).toBe('https://asaas.local/api')
    expect(configDoCreate().headers.access_token).toBe('generica-999999')
  })

  it('URLs específicas por ambiente têm prioridade sobre a genérica', () => {
    vi.stubEnv('ASAAS_BASE_URL', 'https://generica')
    vi.stubEnv('ASAAS_BASE_URL_SANDBOX', 'https://sandbox.custom')
    new AsaasService()
    expect(configDoCreate().baseURL).toBe('https://sandbox.custom')
    vi.stubEnv('ASAAS_ENV', 'production')
    vi.stubEnv('ASAAS_BASE_URL_PROD', 'https://prod.custom')
    vi.stubEnv('ASAAS_API_KEY_PROD', 'p')
    new AsaasService()
    expect(configDoCreate().baseURL).toBe('https://prod.custom')
  })

  it('normaliza a chave: remove aspas, espaços e a barra antes do $', () => {
    vi.stubEnv('ASAAS_API_KEY_SANDBOX', ` "\\$aact_chave_longa" `)
    new AsaasService()
    expect(configDoCreate().headers.access_token).toBe('$aact_chave_longa')
  })

  it('chave curta aparece mascarada como ***', () => {
    vi.stubEnv('ASAAS_API_KEY_SANDBOX', 'curta')
    new AsaasService()
    expect(console.info).toHaveBeenCalledWith(expect.stringContaining('key=***'))
  })

  it('sem chave lança erro de configuração', () => {
    vi.stubEnv('ASAAS_API_KEY_SANDBOX', '')
    expect(() => new AsaasService()).toThrow('Chave da API do Asaas não configurada')
  })

  it('export default é a própria classe', () => {
    expect(AsaasDefault).toBe(AsaasService)
  })
})

describe('AsaasService: clientes', () => {
  it('veterinário novo: busca por externalReference e e-mail, depois cria com CNPJ preferido', async () => {
    http.get.mockResolvedValueOnce(lista()).mockResolvedValueOnce(lista())
    http.post.mockResolvedValueOnce({ data: { id: 'cus_1' } })
    const r = await new AsaasService().ensureCustomerForVeterinario(USER, { id: 'v1', cpf: '111', cnpj: '222' })
    expect(r).toEqual({ id: 'cus_1' })
    expect(http.get.mock.calls[0]).toEqual(['/customers', { params: { externalReference: 'vet:v1' } }])
    expect(http.get.mock.calls[1]).toEqual(['/customers', { params: { email: 'ana@x.com' } }])
    expect(http.post).toHaveBeenCalledWith('/customers', {
      name: 'Ana Lima',
      email: 'ana@x.com',
      mobilePhone: '81999990000',
      cpfCnpj: '222',
      externalReference: 'vet:v1',
    })
  })

  it('veterinário existente igual: não atualiza nem cria', async () => {
    const existente = { id: 'cus_1', name: 'Ana Lima', email: 'ana@x.com', mobilePhone: '81999990000', cpfCnpj: '111' }
    http.get.mockResolvedValueOnce(lista(existente))
    const r = await new AsaasService().ensureCustomerForVeterinario(USER, { id: 'v1', cpf: '111', cnpj: null })
    expect(r).toBe(existente)
    expect(http.get).toHaveBeenCalledTimes(1)
    expect(http.put).not.toHaveBeenCalled()
    expect(http.post).not.toHaveBeenCalled()
  })

  it('sem e-mail não busca por e-mail', async () => {
    http.get.mockResolvedValueOnce({ data: {} })
    http.post.mockResolvedValueOnce({ data: { id: 'cus_2' } })
    await new AsaasService().ensureCustomerForVeterinario(
      { ...USER, email: '', celular: null },
      { id: 'v1', cpf: null, cnpj: null }
    )
    expect(http.get).toHaveBeenCalledTimes(1)
    expect(http.post.mock.calls[0][1]).toMatchObject({ mobilePhone: undefined, cpfCnpj: undefined })
  })

  it('cliente achado por e-mail sem CPF/CNPJ é atualizado e relido', async () => {
    const existente = { id: 'cus_9', name: 'Ana Lima', email: 'ana@x.com', mobilePhone: '81999990000', cpfCnpj: null }
    http.get
      .mockResolvedValueOnce(lista())
      .mockResolvedValueOnce(lista(existente))
      .mockResolvedValueOnce({ data: { ...existente, cpfCnpj: '111' } })
    const r = await new AsaasService().ensureCustomerForVeterinario(USER, { id: 'v1', cpf: '111', cnpj: null })
    expect(http.put).toHaveBeenCalledWith('/customers/cus_9', {
      name: 'Ana Lima',
      email: 'ana@x.com',
      mobilePhone: '81999990000',
      cpfCnpj: '111',
    })
    expect(http.get.mock.calls[2][0]).toBe('/customers/cus_9')
    expect(r.cpfCnpj).toBe('111')
  })

  it('nome, e-mail ou celular diferentes disparam atualização mantendo o CPF existente', async () => {
    const existente = { id: 'c', name: 'Antigo', email: 'old@x.com', mobilePhone: '000', cpfCnpj: '999' }
    http.get.mockResolvedValueOnce(lista(existente)).mockResolvedValueOnce({ data: existente })
    await new AsaasService().ensureCustomerForVeterinario(USER, { id: 'v1', cpf: null, cnpj: null })
    expect(http.put.mock.calls[0][1]).toEqual({ name: 'Ana Lima', email: 'ana@x.com', mobilePhone: '81999990000', cpfCnpj: '999' })
  })

  it('só o e-mail diferente já atualiza; campos ausentes usam os do Asaas', async () => {
    const existente = { id: 'c', name: 'Ana Lima', email: 'old@x.com', mobilePhone: '000', cpfCnpj: '999' }
    http.get.mockResolvedValueOnce(lista(existente)).mockResolvedValueOnce({ data: existente })
    await new AsaasService().ensureCustomerForVeterinario({ ...USER, celular: null }, { id: 'v1', cpf: null, cnpj: null })
    expect(http.put.mock.calls[0][1]).toEqual({ name: 'Ana Lima', email: 'ana@x.com', mobilePhone: '000', cpfCnpj: '999' })
  })

  it('só o nome diferente: e-mail vazio mantém o e-mail do Asaas', async () => {
    const existente = { id: 'c', name: 'Antigo', email: 'old@x.com', mobilePhone: '000', cpfCnpj: '999' }
    http.get.mockResolvedValueOnce(lista(existente)).mockResolvedValueOnce({ data: existente })
    await new AsaasService().ensureCustomerForPrestador({ ...USER, email: '', celular: null }, { id: 'p', cpf: null, cnpj: null })
    expect(http.put.mock.calls[0][1]).toEqual({ name: 'Ana Lima', email: 'old@x.com', mobilePhone: '000', cpfCnpj: '999' })
  })

  it('nome vazio no cadastro mantém o nome do Asaas', async () => {
    const existente = { id: 'c', name: 'Nome Asaas', email: 'old@x.com', mobilePhone: '000', cpfCnpj: '999' }
    http.get.mockResolvedValueOnce(lista(existente)).mockResolvedValueOnce({ data: existente })
    await new AsaasService().ensureCustomerForVeterinario({ ...USER, nome: '', sobrenome: '' }, { id: 'v', cpf: null, cnpj: null })
    expect(http.put.mock.calls[0][1].name).toBe('Nome Asaas')
  })

  it('só o celular diferente já atualiza', async () => {
    const existente = { id: 'c', name: 'Ana Lima', email: 'ana@x.com', mobilePhone: '000', cpfCnpj: '999' }
    http.get.mockResolvedValueOnce(lista(existente)).mockResolvedValueOnce({ data: existente })
    await new AsaasService().ensureCustomerForVeterinario(USER, { id: 'v1', cpf: null, cnpj: null })
    expect(http.put).toHaveBeenCalledTimes(1)
  })

  it('veterinário: erro HTTP ao criar é logado com status e propagado', async () => {
    http.get.mockResolvedValueOnce(lista()).mockResolvedValueOnce(lista())
    const erro = Object.assign(new Error('400'), { response: { status: 400, data: { errors: ['cpf'] } } })
    http.post.mockRejectedValueOnce(erro)
    await expect(new AsaasService().ensureCustomerForVeterinario(USER, { id: 'v1', cpf: 'x', cnpj: null })).rejects.toBe(erro)
    expect(console.error).toHaveBeenCalledWith('[AsaasService.ensureCustomerForVeterinario] Error:', {
      status: 400,
      data: { errors: ['cpf'] },
    })
  })

  it('veterinário: erro ao atualizar existente não loga, mas propaga', async () => {
    http.get.mockResolvedValueOnce(lista({ id: 'c', name: 'X' }))
    http.put.mockRejectedValueOnce(Object.assign(new Error('500'), { response: { status: 500 } }))
    await expect(new AsaasService().ensureCustomerForVeterinario(USER, { id: 'v1', cpf: null, cnpj: null })).rejects.toThrow('500')
    expect(console.error).not.toHaveBeenCalled()
  })

  it('veterinário: erro sem response (rede) não loga, mas propaga', async () => {
    http.get.mockResolvedValueOnce(lista()).mockResolvedValueOnce(lista())
    http.post.mockRejectedValueOnce(new Error('ECONNRESET'))
    await expect(new AsaasService().ensureCustomerForVeterinario(USER, { id: 'v1', cpf: null, cnpj: null })).rejects.toThrow('ECONNRESET')
    expect(console.error).not.toHaveBeenCalled()
  })

  const CLINICA = { id: 'c1', razaoSocial: 'Pet LTDA', nomeClinica: 'Pet Clin', cnpj: '123', whatsapp: '81911112222', telefone: '8133334444' }

  it('clínica nova: razão social, WhatsApp e CNPJ', async () => {
    http.get.mockResolvedValueOnce(lista()).mockResolvedValueOnce(lista())
    http.post.mockResolvedValueOnce({ data: { id: 'cus_c' } })
    await new AsaasService().ensureCustomerForClinica(USER, CLINICA)
    expect(http.get.mock.calls[0][1]).toEqual({ params: { externalReference: 'clinica:c1' } })
    expect(http.post).toHaveBeenCalledWith('/customers', {
      name: 'Pet LTDA',
      email: 'ana@x.com',
      mobilePhone: '81911112222',
      cpfCnpj: '123',
      externalReference: 'clinica:c1',
    })
  })

  it('clínica: nome cai para nome fantasia, depois nome do usuário, depois "Clínica Sem Nome"', async () => {
    const s = new AsaasService()
    http.get.mockResolvedValue(lista())
    http.post.mockResolvedValue({ data: {} })
    await s.ensureCustomerForClinica(USER, { ...CLINICA, razaoSocial: null })
    await s.ensureCustomerForClinica(USER, { ...CLINICA, razaoSocial: null, nomeClinica: null, whatsapp: null })
    await s.ensureCustomerForClinica(
      { nome: '', sobrenome: '', email: '', celular: null },
      { ...CLINICA, razaoSocial: null, nomeClinica: null, whatsapp: null, telefone: null, cnpj: null }
    )
    await s.ensureCustomerForClinica(
      { nome: null as unknown as string, sobrenome: null as unknown as string, email: 'z@x.com', celular: '81900000000' },
      { ...CLINICA, razaoSocial: null, nomeClinica: null, whatsapp: null, telefone: null }
    )
    const bodies = http.post.mock.calls.map((c) => c[1])
    expect(bodies[0]).toMatchObject({ name: 'Pet Clin', mobilePhone: '81911112222' })
    expect(bodies[1]).toMatchObject({ name: 'Ana Lima', mobilePhone: '8133334444' })
    expect(bodies[2]).toMatchObject({ name: 'Clínica Sem Nome', email: undefined, mobilePhone: undefined, cpfCnpj: undefined })
    expect(bodies[3]).toMatchObject({ name: 'Clínica Sem Nome', mobilePhone: '81900000000' })
  })

  it('clínica: erro HTTP ao criar é logado em JSON e propagado', async () => {
    http.get.mockResolvedValueOnce(lista()).mockResolvedValueOnce(lista())
    http.post.mockRejectedValueOnce(Object.assign(new Error('400'), { response: { status: 400, data: 'cnpj' } }))
    await expect(new AsaasService().ensureCustomerForClinica(USER, CLINICA)).rejects.toThrow('400')
    expect(console.error).toHaveBeenCalledWith(
      '[AsaasService.ensureCustomerForClinica] Error:',
      JSON.stringify({ status: 400, data: 'cnpj' }, null, 2)
    )
  })

  it('clínica: erro com cliente existente não loga', async () => {
    http.get.mockResolvedValueOnce(lista({ id: 'c', name: 'Outro' }))
    http.put.mockRejectedValueOnce(Object.assign(new Error('409'), { response: { status: 409 } }))
    await expect(new AsaasService().ensureCustomerForClinica(USER, CLINICA)).rejects.toThrow('409')
    expect(console.error).not.toHaveBeenCalled()
  })

  it('prestador: referência prestador:id, CNPJ ou CPF, sobrenome opcional', async () => {
    http.get.mockResolvedValue(lista())
    http.post.mockResolvedValue({ data: { id: 'p' } })
    const s = new AsaasService()
    await s.ensureCustomerForPrestador({ ...USER, sobrenome: null as unknown as string }, { id: 'pr1', cpf: '111', cnpj: null })
    await s.ensureCustomerForPrestador({ ...USER, celular: null }, { id: 'pr1', cpf: null, cnpj: '222' })
    await s.ensureCustomerForPrestador(USER, { id: 'pr1', cpf: null, cnpj: null })
    expect(http.get.mock.calls[0][1]).toEqual({ params: { externalReference: 'prestador:pr1' } })
    const bodies = http.post.mock.calls.map((c) => c[1])
    expect(bodies[0]).toMatchObject({ name: 'Ana', cpfCnpj: '111', externalReference: 'prestador:pr1' })
    expect(bodies[1]).toMatchObject({ cpfCnpj: '222', mobilePhone: undefined })
    expect(bodies[2]).toMatchObject({ cpfCnpj: undefined })
  })

  it('tutor: busca só por externalReference (sem fallback por e-mail)', async () => {
    http.get.mockResolvedValueOnce({ data: undefined })
    http.post.mockResolvedValueOnce({ data: { id: 't' } })
    await new AsaasService().ensureCustomerForTutor(USER, { id: 't1', cpf: '111' })
    expect(http.get).toHaveBeenCalledTimes(1)
    expect(http.get).toHaveBeenCalledWith('/customers', { params: { externalReference: 'tutor:t1' } })
    expect(http.post.mock.calls[0][1]).toEqual({
      name: 'Ana Lima',
      email: 'ana@x.com',
      mobilePhone: '81999990000',
      cpfCnpj: '111',
      externalReference: 'tutor:t1',
    })
  })

  it('tutor existente sem CPF e sem celular', async () => {
    const existente = { id: 'c', name: 'Ana Lima', email: 'ana@x.com', mobilePhone: '1' }
    http.get.mockResolvedValueOnce(lista(existente))
    expect(await new AsaasService().ensureCustomerForTutor({ ...USER, celular: null }, { id: 't1', cpf: null })).toBe(existente)
  })
})

describe('AsaasService: assinaturas e pagamentos', () => {
  it('createSubscription: padrão mensal, cobrança UNDEFINED e vencimento hoje (data de Brasília)', async () => {
    http.post.mockResolvedValueOnce({ data: { id: 'sub_1' } })
    const r = await new AsaasService().createSubscription({ customerId: 'cus_1', value: 49.9 })
    expect(r).toEqual({ id: 'sub_1' })
    expect(http.post).toHaveBeenCalledWith('/subscriptions', {
      customer: 'cus_1',
      value: 49.9,
      cycle: 'MONTHLY',
      description: undefined,
      billingType: 'UNDEFINED',
      creditCardToken: undefined,
      nextDueDate: dataLocal(new Date()),
      externalReference: undefined,
    })
  })

  it('createSubscription: repassa os campos informados (vencimento = fim do teste)', async () => {
    http.post.mockResolvedValueOnce({ data: {} })
    await new AsaasService().createSubscription({
      customerId: 'c',
      value: 10,
      cycle: 'YEARLY',
      description: 'Plano Pro',
      billingType: 'CREDIT_CARD',
      creditCardToken: 'tok',
      nextDueDate: '2026-11-01',
      externalReference: 'sub:1',
    })
    expect(http.post.mock.calls[0][1]).toEqual({
      customer: 'c',
      value: 10,
      cycle: 'YEARLY',
      description: 'Plano Pro',
      billingType: 'CREDIT_CARD',
      creditCardToken: 'tok',
      nextDueDate: '2026-11-01',
      externalReference: 'sub:1',
    })
  })

  it('getSubscription, getSubscriptionPayments, cancelSubscription', async () => {
    const s = new AsaasService()
    http.get.mockResolvedValueOnce({ data: { id: 'sub_1' } }).mockResolvedValueOnce({ data: { data: [] } })
    http.delete.mockResolvedValueOnce({ data: { deleted: true } })
    expect(await s.getSubscription('sub_1')).toEqual({ id: 'sub_1' })
    expect(await s.getSubscriptionPayments('sub_1')).toEqual({ data: [] })
    expect(await s.cancelSubscription('sub_1')).toEqual({ deleted: true })
    expect(http.get.mock.calls[0][0]).toBe('/subscriptions/sub_1')
    expect(http.get.mock.calls[1]).toEqual(['/payments', { params: { subscription: 'sub_1' } }])
    expect(http.delete).toHaveBeenCalledWith('/subscriptions/sub_1')
  })

  it('updateSubscription envia só os campos editáveis', async () => {
    http.put.mockResolvedValueOnce({ data: { ok: 1 } })
    const r = await new AsaasService().updateSubscription('sub_1', { value: 99, customerId: 'ignorado', nextDueDate: '2026-12-01' })
    expect(r).toEqual({ ok: 1 })
    expect(http.put).toHaveBeenCalledWith('/subscriptions/sub_1', {
      value: 99,
      cycle: undefined,
      description: undefined,
      billingType: undefined,
      nextDueDate: '2026-12-01',
    })
  })

  it('createPixPayment com e sem campos opcionais', async () => {
    http.post.mockResolvedValue({ data: { id: 'pay' } })
    const s = new AsaasService()
    await s.createPixPayment({ customerId: 'c', value: 5 })
    await s.createPixPayment({ customerId: 'c', value: 5, description: 'd', externalReference: 'e', dueDate: '2026-10-10' })
    expect(http.post.mock.calls[0]).toEqual([
      '/payments',
      { customer: 'c', billingType: 'PIX', value: 5, description: undefined, externalReference: undefined, dueDate: undefined },
    ])
    expect(http.post.mock.calls[1][1]).toMatchObject({ description: 'd', externalReference: 'e', dueDate: '2026-10-10' })
  })

  it('getPixQrCode', async () => {
    http.get.mockResolvedValueOnce({ data: { payload: 'pix' } })
    expect(await new AsaasService().getPixQrCode('pay_1')).toEqual({ payload: 'pix' })
    expect(http.get).toHaveBeenCalledWith('/payments/pay_1/pixQrCode')
  })
})

describe('URLs de fatura', () => {
  const comPagamentos = (data: unknown) =>
    ({ getSubscriptionPayments: vi.fn().mockResolvedValue(data) }) as unknown as AsaasService

  const PAGAMENTOS = [
    { status: 'RECEIVED', dueDate: '2026-12-01', invoiceUrl: 'recebida-dez' },
    { status: 'OVERDUE', dueDate: '2026-09-01', invoiceUrl: 'vencida-set' },
    { status: 'PENDING', dueDate: '2026-10-01', invoiceUrl: 'pendente-out' },
  ]

  it('getCheckoutUrl: a pendente/vencida mais recente', async () => {
    expect(await getCheckoutUrl(comPagamentos({ data: [...PAGAMENTOS] }), 'sub')).toBe('pendente-out')
  })

  it('getCheckoutUrl: sem abertas usa a mais recente; sem nada devolve null', async () => {
    expect(
      await getCheckoutUrl(
        comPagamentos({
          data: [
            { status: 'RECEIVED', dueDate: '2026-01-01', invoiceUrl: 'jan' },
            { status: 'RECEIVED', dueDate: '2026-02-01', invoiceUrl: 'fev' },
          ],
        }),
        'sub'
      )
    ).toBe('fev')
    expect(await getCheckoutUrl(comPagamentos(null), 'sub')).toBeNull()
    expect(await getCheckoutUrl(comPagamentos({ data: [{ status: 'PENDING', dueDate: '2026-01-01' }] }), 'sub')).toBeNull()
  })

  it('getPendingInvoiceUrl: a aberta mais antiga; null se nada a pagar', async () => {
    expect(await getPendingInvoiceUrl(comPagamentos({ data: [...PAGAMENTOS] }), 'sub')).toBe('vencida-set')
    expect(await getPendingInvoiceUrl(comPagamentos({ data: [PAGAMENTOS[0]] }), 'sub')).toBeNull()
    expect(await getPendingInvoiceUrl(comPagamentos(undefined), 'sub')).toBeNull()
    expect(await getPendingInvoiceUrl(comPagamentos({ data: [{ status: 'PENDING', dueDate: '2026-01-01' }] }), 'sub')).toBeNull()
  })
})
