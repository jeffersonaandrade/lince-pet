import { describe, it, expect, vi, beforeEach } from 'vitest'

const api = vi.hoisted(() => ({ get: vi.fn() }))
const createMock = vi.hoisted(() => vi.fn(() => api))
vi.mock('axios', () => ({ default: { create: createMock } }))

import { fetchCep, fetchCnpj, isNotFoundOrTimeout } from '@/server/services/brazilapi'

beforeEach(() => {
  api.get.mockReset()
})

describe('brazilapi', () => {
  it('cria o client apontando para a BrasilAPI com timeout de 5s', () => {
    expect(createMock).toHaveBeenCalledWith({ baseURL: 'https://brasilapi.com.br/api', timeout: 5000 })
  })

  it('fetchCep: remove a máscara e traduz os campos para português', async () => {
    api.get.mockResolvedValueOnce({
      data: { cep: '50000000', state: 'PE', city: 'Recife', neighborhood: 'Boa Vista', street: 'Rua A', extra: 1 },
    })
    const r = await fetchCep('50.000-000')
    expect(api.get).toHaveBeenCalledWith('/cep/v2/50000000')
    expect(r).toEqual({ cep: '50000000', estado: 'PE', cidade: 'Recife', bairro: 'Boa Vista', rua: 'Rua A' })
  })

  it('fetchCep: propaga erro da API', async () => {
    api.get.mockRejectedValueOnce(Object.assign(new Error('nf'), { response: { status: 404 } }))
    await expect(fetchCep('00000-000')).rejects.toThrow('nf')
  })

  it('fetchCnpj: remove a máscara e devolve os dados crus', async () => {
    const dados = { razao_social: 'Pet LTDA' }
    api.get.mockResolvedValueOnce({ data: dados })
    expect(await fetchCnpj('12.345.678/0001-90')).toBe(dados)
    expect(api.get).toHaveBeenCalledWith('/cnpj/v1/12345678000190')
  })

  it('isNotFoundOrTimeout: 404 ou timeout de conexão', () => {
    expect(isNotFoundOrTimeout({ response: { status: 404 } })).toBe(true)
    expect(isNotFoundOrTimeout({ code: 'ECONNABORTED' })).toBe(true)
    expect(isNotFoundOrTimeout({ response: { status: 500 } })).toBe(false)
    expect(isNotFoundOrTimeout(null)).toBe(false)
    expect(isNotFoundOrTimeout(undefined)).toBe(false)
  })
})
