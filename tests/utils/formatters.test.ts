import { describe, expect, it } from 'vitest'
import { formatPhone, toWhatsAppLink } from '@/utils/formatters'

describe('formatPhone', () => {
  it('formata fixo (10 dígitos) e celular (11 dígitos)', () => {
    expect(formatPhone('1133334444')).toBe('(11) 3333-4444')
    expect(formatPhone('11987654321')).toBe('(11) 98765-4321')
  })

  it('aplica a máscara parcial enquanto o usuário digita', () => {
    expect(['1', '11', '119', '119876', '1198765', '119876543'].map(formatPhone)).toEqual([
      '1',
      '11',
      '(11) 9',
      '(11) 9876',
      '(11) 9876-5',
      '(11) 9876-543',
    ])
  })

  it('ignora o que não é dígito e corta acima de 11 dígitos', () => {
    expect(formatPhone('(11) 98765-4321')).toBe('(11) 98765-4321')
    expect(formatPhone('119876543210000')).toBe('(11) 98765-4321')
  })
})

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
