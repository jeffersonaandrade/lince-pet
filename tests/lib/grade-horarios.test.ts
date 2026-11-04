import { describe, expect, it } from 'vitest'
import { BLOCOS_30_MIN, blocosNoIntervalo, diaInteiro24h, unirHorarios } from '@/lib/grade-horarios'

describe('grade-horarios', () => {
  it('tem 48 blocos de 00:00 a 23:30', () => {
    expect(BLOCOS_30_MIN).toHaveLength(48)
    expect(BLOCOS_30_MIN[0]).toBe('00:00')
    expect(BLOCOS_30_MIN.at(-1)).toBe('23:30')
  })

  it('intervalo das 08:00 às 18:00 marca até 17:30', () => {
    const blocos = blocosNoIntervalo('08:00', '18:00')
    expect(blocos[0]).toBe('08:00')
    expect(blocos.at(-1)).toBe('17:30')
    expect(blocos).not.toContain('18:00')
  })

  it('até 24:00 cobre o último bloco', () => {
    expect(blocosNoIntervalo('23:00', '24:00')).toEqual(['23:00', '23:30'])
    expect(diaInteiro24h()).toEqual(BLOCOS_30_MIN)
  })

  it('intervalo inválido não marca nada', () => {
    expect(blocosNoIntervalo('18:00', '08:00')).toEqual([])
    expect(blocosNoIntervalo('10:00', '10:00')).toEqual([])
  })

  it('unirHorarios remove duplicados e ordena', () => {
    expect(unirHorarios(['10:00', '09:00'], ['10:00', '11:00'])).toEqual(['09:00', '10:00', '11:00'])
  })
})
