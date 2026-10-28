import { describe, expect, it } from 'vitest'
import { urlFaturaAsaas, destinoAposPagamento } from '@/lib/pagamento-navegacao'

describe('navegação do pagamento', () => {
  it.each(['https://www.asaas.com/i/teste', 'https://asaas.com/i/teste?origem=email', 'https://sandbox.asaas.com/i/teste'])('permite fatura oficial e solicita retorno: %s', url => {
    const resultado = new URL(urlFaturaAsaas(url)!)
    expect(resultado.searchParams.get('autoRedirect')).toBe('true')
    expect(resultado.pathname).toBe('/i/teste')
  })
  it.each([null, '', 'javascript:alert(1)', '//asaas.com/i/teste', 'https://asaas.com.evil.test/i/x', 'https://asaas.com@evil.test', 'https://user:pass@asaas.com/i/x', 'http://asaas.com/i/x', 'https://asaas.com:8888/i/x'])('recusa destino externo inválido %s', valor => {
    expect(urlFaturaAsaas(valor)).toBeNull()
  })
  it.each(['veterinario','clinica','prestador'])('volta ao painel de %s quando cadastro completo', userType => {
    expect(destinoAposPagamento({ userType, onboardingComplete: 1 })).toBe(`/dashboard/${userType}`)
  })
  it.each([['veterinario','/onboarding'],['clinica','/onboarding/clinica'],['prestador','/onboarding/prestador']])('continua cadastro incompleto de %s', (userType, destino) => {
    expect(destinoAposPagamento({ userType, onboardingComplete: 0 })).toBe(destino)
  })
  it('não aceita contexto desconhecido como destino', () => expect(destinoAposPagamento({userType:'//evil.test'})).toBe('/'))
})
