import 'server-only'
import axios from 'axios'

const api = axios.create({ baseURL: 'https://brasilapi.com.br/api', timeout: 5000 })

export async function fetchCep(cep: string) {
  const { data } = await api.get(`/cep/v2/${cep.replace(/\D/g, '')}`)
  return {
    cep: data.cep,
    estado: data.state,
    cidade: data.city,
    bairro: data.neighborhood,
    rua: data.street,
  }
}

export async function fetchCnpj(cnpj: string) {
  const { data } = await api.get(`/cnpj/v1/${cnpj.replace(/\D/g, '')}`)
  return data
}

export const isNotFoundOrTimeout = (error: any) =>
  error?.response?.status == 404 || error?.code == 'ECONNABORTED'
