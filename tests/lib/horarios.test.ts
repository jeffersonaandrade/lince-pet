import { describe, expect, it } from 'vitest'
import { dataParaIso, diaDaSemana, iniciosQueCabemNaGrade, normalizarDia, normalizarGrade } from '@/lib/horarios'

describe('normalizarDia', () => {
  it('ignora caixa, acento e o sufixo -feira', () => {
    expect(['Segunda-feira', 'SEGUNDA', ' segunda '].map(normalizarDia)).toEqual(['segunda', 'segunda', 'segunda'])
    expect(normalizarDia('Terça-Feira')).toBe('terca')
    expect(normalizarDia('Sábado')).toBe('sabado')
  })
})

describe('normalizarGrade', () => {
  it('aceita objeto ou JSON em texto e normaliza as chaves', () => {
    expect(normalizarGrade({ 'Quarta-feira': ['08:00'] })).toEqual({ quarta: ['08:00'] })
    expect(normalizarGrade('{"Sábado":["09:00","10:00"]}')).toEqual({ sabado: ['09:00', '10:00'] })
  })

  it('descarta dias que não são lista e itens que não são texto', () => {
    expect(normalizarGrade({ segunda: '08:00', terca: ['08:00', 9, null, '09:00'] })).toEqual({ terca: ['08:00', '09:00'] })
  })

  it('valor vazio, inválido, lista ou JSON quebrado vira grade vazia', () => {
    for (const valor of [null, undefined, '', '{quebrado', 42, ['08:00'], '"texto"']) {
      expect(normalizarGrade(valor)).toEqual({})
    }
  })
})

describe('diaDaSemana', () => {
  it('usa o dia local da data', () => {
    expect(diaDaSemana('2026-10-18')).toBe('domingo')
    expect(diaDaSemana('2026-10-19')).toBe('segunda')
    expect(diaDaSemana('2026-10-24')).toBe('sabado')
  })

  it('data inválida devolve null', () => {
    expect(diaDaSemana('19/10/2026')).toBeNull()
    expect(diaDaSemana('')).toBeNull()
  })
})

describe('dataParaIso', () => {
  it('converte DD/MM/YYYY e corta ISO com hora', () => {
    expect(dataParaIso('05/03/2026')).toBe('2026-03-05')
    expect(dataParaIso('2026-03-05T10:00:00.000Z')).toBe('2026-03-05')
  })

  it('vazio vira texto vazio', () => {
    expect(dataParaIso(null)).toBe('')
    expect(dataParaIso(undefined)).toBe('')
    expect(dataParaIso('')).toBe('')
  })
})

describe('iniciosQueCabemNaGrade', () => {
  const quinta = ['08:30', '09:00', '09:30', '10:00', '10:30', '11:00', '11:30', '13:00', '13:30', '14:00', '14:30', '15:00', '15:30', '16:00', '16:30']

  it('com 30 minutos, todos os blocos marcados são início válido', () => {
    expect(iniciosQueCabemNaGrade(quinta, 30)).toEqual(quinta)
  })

  it('com 45 minutos, some o último bloco e o que fica antes do intervalo', () => {
    expect(iniciosQueCabemNaGrade(quinta, 45)).toEqual([
      '08:30', '09:00', '09:30', '10:00', '10:30', '11:00',
      '13:00', '13:30', '14:00', '14:30', '15:00', '15:30', '16:00',
    ])
  })

  it('duração inválida ou grade vazia não oferece início', () => {
    expect(iniciosQueCabemNaGrade(quinta, 0)).toEqual([])
    expect(iniciosQueCabemNaGrade([], 45)).toEqual([])
  })
})
