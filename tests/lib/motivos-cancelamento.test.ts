import { describe, it, expect } from 'vitest'
import { MOTIVOS_CANCELAMENTO_TUTOR, motivoDoTutor } from '@/lib/motivos-cancelamento'

describe('motivoDoTutor', () => {
  it('traduz o código para o texto padrão', () => {
    for (const [codigo, texto] of Object.entries(MOTIVOS_CANCELAMENTO_TUTOR)) expect(motivoDoTutor(codigo)).toBe(texto)
  })

  it('ignora texto livre e código desconhecido', () => {
    expect(motivoDoTutor('Acesse https://golpe.example')).toBeNull()
    expect(motivoDoTutor('__proto__')).toBeNull()
    expect(motivoDoTutor(null)).toBeNull()
  })
})
