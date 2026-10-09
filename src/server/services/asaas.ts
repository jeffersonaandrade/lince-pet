import 'server-only'
import axios, { type AxiosInstance } from 'axios'
import type { Clinica, Prestador, Tutor, User, Veterinario } from '@prisma/client'
import { env } from '../env'
import { dataLocal } from './assinatura-regras'

type AsaasEnv = 'sandbox' | 'production'

/** UNDEFINED: o cliente escolhe Pix, boleto ou cartão na fatura do Asaas. */
export type BillingType = 'PIX' | 'BOLETO' | 'CREDIT_CARD' | 'UNDEFINED'

export type CreateSubscriptionInput = {
  customerId: string
  value: number
  cycle?: 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY' | 'BIMONTHLY' | 'QUARTERLY' | 'SEMIANNUALLY' | 'YEARLY'
  description?: string
  billingType?: BillingType
  creditCardToken?: string
  nextDueDate?: string // yyyy-mm-dd
  externalReference?: string
}

type CustomerUser = Pick<User, 'nome' | 'sobrenome' | 'email' | 'celular'>

const normalize = (v?: string) => {
  if (!v) return undefined
  let s = v.trim().replace(/^['"]|['"]$/g, '')
  if (s.startsWith('\\$')) s = s.slice(1)
  return s
}

export class AsaasService {
  private http: AxiosInstance
  private baseUrl: string

  constructor() {
    const mode = (env('ASAAS_ENV') as AsaasEnv | undefined) || 'sandbox'
    const genericBase = env('ASAAS_BASE_URL')
    const baseSandbox = env('ASAAS_BASE_URL_SANDBOX') || genericBase || 'https://sandbox.asaas.com/api/v3'
    const baseProd = env('ASAAS_BASE_URL_PROD') || genericBase || 'https://www.asaas.com/api/v3'
    const genericKey = normalize(env('ASAAS_API_KEY'))
    const prodKey = normalize(env('ASAAS_API_KEY_PROD'))
    const sandKey = normalize(env('ASAAS_API_KEY_SANDBOX'))
    const apiKey = (mode === 'production' ? prodKey || genericKey : sandKey || genericKey) || ''

    if (!apiKey) {
      throw new Error('Chave da API do Asaas não configurada (verifique ASAAS_API_KEY_SANDBOX/PROD)')
    }

    this.baseUrl = mode === 'production' ? baseProd : baseSandbox
    this.http = axios.create({
      baseURL: this.baseUrl,
      headers: { 'Content-Type': 'application/json', access_token: apiKey },
      timeout: 15000,
    })

    const masked = apiKey.length > 8 ? `${apiKey.slice(0, 4)}...${apiKey.slice(-4)}` : '***'
    console.info(`[AsaasService] env=${mode} base=${this.baseUrl} key=${masked}`)
  }

  private async upsertCustomer(
    existing: any,
    desired: { name: string; email?: string | null; mobilePhone?: string; cpfCnpj?: string },
    externalReference: string
  ) {
    if (existing) {
      const needsUpdate =
        (!existing.cpfCnpj && !!desired.cpfCnpj) ||
        (desired.name && existing.name !== desired.name) ||
        (desired.email && existing.email !== desired.email) ||
        (desired.mobilePhone && existing.mobilePhone !== desired.mobilePhone)

      if (needsUpdate) {
        await this.http.put(`/customers/${existing.id}`, {
          name: desired.name || existing.name,
          email: desired.email || existing.email,
          mobilePhone: desired.mobilePhone || existing.mobilePhone,
          cpfCnpj: desired.cpfCnpj || existing.cpfCnpj,
        })
        const refreshed = await this.http.get(`/customers/${existing.id}`)
        return refreshed.data
      }
      return existing
    }

    const res = await this.http.post('/customers', { ...desired, externalReference })
    return res.data
  }

  private async findCustomer(externalReference: string, email?: string | null) {
    let found = await this.http.get('/customers', { params: { externalReference } })
    let existing = found.data?.data?.[0]
    if (!existing && email) {
      found = await this.http.get('/customers', { params: { email } })
      existing = found.data?.data?.[0]
    }
    return existing
  }

  async ensureCustomerForVeterinario(user: CustomerUser, vet: Pick<Veterinario, 'id' | 'cpf' | 'cnpj'>) {
    const externalReference = `vet:${vet.id}`
    const existing = await this.findCustomer(externalReference, user.email)
    try {
      return await this.upsertCustomer(
        existing,
        {
          name: `${user.nome} ${user.sobrenome}`.trim(),
          email: user.email,
          mobilePhone: user.celular || undefined,
          cpfCnpj: vet.cnpj || vet.cpf || undefined,
        },
        externalReference
      )
    } catch (error: any) {
      if (!existing && error.response) {
        console.error('[AsaasService.ensureCustomerForVeterinario] Error:', {
          status: error.response.status,
          data: error.response.data,
        })
      }
      throw error
    }
  }

  async ensureCustomerForClinica(
    user: CustomerUser,
    clinica: Pick<Clinica, 'id' | 'razaoSocial' | 'nomeClinica' | 'cnpj' | 'whatsapp' | 'telefone'>
  ) {
    const externalReference = `clinica:${clinica.id}`
    const existing = await this.findCustomer(externalReference, user.email)
    try {
      return await this.upsertCustomer(
        existing,
        {
          name:
            (clinica.razaoSocial || clinica.nomeClinica || `${user.nome || ''} ${user.sobrenome || ''}`).trim() ||
            'Clínica Sem Nome',
          email: user.email || undefined,
          mobilePhone: clinica.whatsapp || clinica.telefone || user.celular || undefined,
          cpfCnpj: clinica.cnpj || undefined,
        },
        externalReference
      )
    } catch (error: any) {
      if (!existing && error.response) {
        console.error(
          '[AsaasService.ensureCustomerForClinica] Error:',
          JSON.stringify({ status: error.response.status, data: error.response.data }, null, 2)
        )
      }
      throw error
    }
  }

  async ensureCustomerForPrestador(user: CustomerUser, prestador: Pick<Prestador, 'id' | 'cpf' | 'cnpj'>) {
    const externalReference = `prestador:${prestador.id}`
    const existing = await this.findCustomer(externalReference, user.email)
    return this.upsertCustomer(
      existing,
      {
        name: `${user.nome} ${user.sobrenome || ''}`.trim(),
        email: user.email,
        mobilePhone: user.celular || undefined,
        cpfCnpj: prestador.cnpj || prestador.cpf || undefined,
      },
      externalReference
    )
  }

  async ensureCustomerForTutor(user: CustomerUser, tutor: Pick<Tutor, 'id' | 'cpf'>) {
    const externalReference = `tutor:${tutor.id}`
    const found = await this.http.get('/customers', { params: { externalReference } })
    return this.upsertCustomer(
      found.data?.data?.[0],
      {
        name: `${user.nome} ${user.sobrenome}`.trim(),
        email: user.email,
        mobilePhone: user.celular || undefined,
        cpfCnpj: tutor.cpf || undefined,
      },
      externalReference
    )
  }

  /** `nextDueDate` é o vencimento da 1a fatura: fim do teste ou hoje (padrão). */
  async createSubscription(input: CreateSubscriptionInput) {
    const payload: any = {
      customer: input.customerId,
      value: input.value,
      cycle: input.cycle || 'MONTHLY',
      description: input.description || undefined,
      billingType: input.billingType || 'UNDEFINED',
      creditCardToken: input.creditCardToken || undefined,
      nextDueDate: input.nextDueDate || dataLocal(new Date()),
      externalReference: input.externalReference || undefined,
    }

    const res = await this.http.post('/subscriptions', payload)
    return res.data
  }

  async getSubscription(subscriptionId: string) {
    const res = await this.http.get(`/subscriptions/${subscriptionId}`)
    return res.data
  }

  async getSubscriptionPayments(subscriptionId: string) {
    const res = await this.http.get('/payments', { params: { subscription: subscriptionId } })
    return res.data
  }

  async cancelSubscription(subscriptionId: string) {
    const res = await this.http.delete(`/subscriptions/${subscriptionId}`)
    return res.data
  }

  async updateSubscription(subscriptionId: string, input: Partial<CreateSubscriptionInput>) {
    const payload: any = {
      value: input.value,
      cycle: input.cycle,
      description: input.description,
      billingType: input.billingType,
      nextDueDate: input.nextDueDate,
    }
    const res = await this.http.put(`/subscriptions/${subscriptionId}`, payload)
    return res.data
  }

  async createPixPayment(input: {
    customerId: string
    value: number
    description?: string
    externalReference?: string
    dueDate?: string // yyyy-mm-dd
  }) {
    const payload: any = {
      customer: input.customerId,
      billingType: 'PIX',
      value: input.value,
      description: input.description || undefined,
      externalReference: input.externalReference || undefined,
      dueDate: input.dueDate || undefined,
    }
    const res = await this.http.post('/payments', payload)
    return res.data
  }

  /** Retorna { encodedImage, payload, expirationDate }. */
  async getPixQrCode(paymentId: string) {
    const res = await this.http.get(`/payments/${paymentId}/pixQrCode`)
    return res.data
  }
}

/** URL da fatura mais recente pendente/vencida (ou a mais recente) da assinatura. */
export async function getCheckoutUrl(service: AsaasService, asaasSubscriptionId: string): Promise<string | null> {
  const paymentsData = await service.getSubscriptionPayments(asaasSubscriptionId)
  const payments: any[] = paymentsData?.data || []
  payments.sort((a, b) => new Date(b.dueDate).getTime() - new Date(a.dueDate).getTime())
  const target = payments.find((p) => p.status === 'PENDING' || p.status === 'OVERDUE') || payments[0]
  return target?.invoiceUrl || null
}

/** URL da fatura em aberto (pendente ou vencida); null se não houver nada a pagar. */
export async function getPendingInvoiceUrl(service: AsaasService, asaasSubscriptionId: string): Promise<string | null> {
  const paymentsData = await service.getSubscriptionPayments(asaasSubscriptionId)
  const payments: any[] = paymentsData?.data || []
  const abertas = payments
    .filter((p) => p.status === 'PENDING' || p.status === 'OVERDUE')
    .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())
  return abertas[0]?.invoiceUrl || null
}

export default AsaasService
