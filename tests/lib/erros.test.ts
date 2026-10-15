import { describe, expect, it } from 'vitest'
import { mensagemDaApi, mensagemDeErro, statusDoErro } from '@/lib/erros'

const erroAxios = (status: number, data?: unknown) =>
  Object.assign(new Error(`Request failed with status code ${status}`), { isAxiosError: true, response: { status, data } })

describe('erros da API', () => {
  it('lê o status HTTP só quando é número', () => {
    expect(statusDoErro(erroAxios(404))).toBe(404)
    expect(statusDoErro({ response: { status: '404' } })).toBeUndefined()
    expect(statusDoErro(new Error('x'))).toBeUndefined()
    expect(statusDoErro(null)).toBeUndefined()
  })

  it('usa message, depois error, e ignora texto vazio', () => {
    expect(mensagemDaApi(erroAxios(400, { message: 'Horário indisponível' }))).toBe('Horário indisponível')
    expect(mensagemDaApi(erroAxios(400, { error: 'Pet não encontrado' }))).toBe('Pet não encontrado')
    expect(mensagemDaApi(erroAxios(400, { message: '  ' }))).toBeUndefined()
    expect(mensagemDaApi(erroAxios(500, '<html>'))).toBeUndefined()
  })

  it('mensagem ao usuário: API, depois Error do app, depois o padrão', () => {
    expect(mensagemDeErro(erroAxios(409, { message: 'Já avaliado' }), 'padrão')).toBe('Já avaliado')
    expect(mensagemDeErro(new Error('Falha ao cancelar'), 'padrão')).toBe('Falha ao cancelar')
    expect(mensagemDeErro('qualquer coisa', 'padrão')).toBe('padrão')
  })

  it('nunca mostra a mensagem técnica do axios', () => {
    expect(mensagemDeErro(erroAxios(500), 'Tente de novo')).toBe('Tente de novo')
  })
})
