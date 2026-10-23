import { describe, expect, it, vi, afterEach } from 'vitest'
import { destinoSeguro, urlDeLogin } from '@/lib/destino-login'

describe('destinoSeguro', () => {
  it('aceita caminhos do site com busca e âncora', () => {
    expect(destinoSeguro('/dashboard/tutor#consultas')).toBe('/dashboard/tutor#consultas')
    expect(destinoSeguro('/veterinario/abc?aba=agenda')).toBe('/veterinario/abc?aba=agenda')
  })

  it.each([
    null,
    undefined,
    '',
    'dashboard',
    'https://malicioso.com',
    '//malicioso.com',
    '/\\malicioso.com',
    '\\\\malicioso.com',
    'javascript:alert(1)',
    '/login',
    '/login?next=/x',
  ])('recusa %s e manda para a home', (valor) => {
    expect(destinoSeguro(valor)).toBe('/')
  })
})

describe('urlDeLogin', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('codifica o destino informado', () => {
    expect(urlDeLogin('/dashboard/tutor#consultas')).toBe('/login?next=%2Fdashboard%2Ftutor%23consultas')
  })

  it('usa a página atual quando não recebe destino', () => {
    vi.stubGlobal('window', { location: { pathname: '/dashboard/clinica', search: '?x=1', hash: '' } })
    expect(urlDeLogin()).toBe('/login?next=%2Fdashboard%2Fclinica%3Fx%3D1')
  })

  it('sem window ou com destino inválido vai para o login simples', () => {
    expect(urlDeLogin()).toBe('/login')
    expect(urlDeLogin('https://malicioso.com')).toBe('/login')
  })
})
