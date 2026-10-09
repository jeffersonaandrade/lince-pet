import { describe, expect, it } from 'vitest'
import { toWhatsAppLink } from '@/utils/formatters'

describe('toWhatsAppLink', () => {
  it('prefixa 55 em celular com máscara', () => {
    expect(toWhatsAppLink('(11) 98765-4321')).toBe('https://wa.me/5511987654321')
  })

  it('aceita fixo com DDD (10 dígitos)', () => {
    expect(toWhatsAppLink('1133334444')).toBe('https://wa.me/551133334444')
  })

  it('mantém número que já tem DDI 55', () => {
    expect(toWhatsAppLink('+55 11 98765-4321')).toBe('https://wa.me/5511987654321')
  })

  it('retorna null para vazio ou inválido', () => {
    expect(toWhatsAppLink(null)).toBeNull()
    expect(toWhatsAppLink('')).toBeNull()
    expect(toWhatsAppLink('98765')).toBeNull()
  })
})
