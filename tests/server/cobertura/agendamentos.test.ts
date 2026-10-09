import { describe, it, expect, afterEach, vi } from 'vitest'
import { DateTime } from 'luxon'
import {
  FUSO_CONSULTA,
  consumeDataConsulta,
  inicioDaConsulta,
  jaPassou,
  nomeCompleto,
  podeSerCancelado,
  prepareDataConsulta,
  prepareDateTimeString,
} from '@/server/services/agendamentos'

afterEach(() => {
  vi.useRealTimers()
})

describe('consumeDataConsulta', () => {
  it('converte a string do banco em DateTime e mantém null', () => {
    const d = consumeDataConsulta('2026-10-15')!
    expect(d.isValid).toBe(true)
    expect(d.toISODate()).toBe('2026-10-15')
    expect(consumeDataConsulta(null)).toBeNull()
  })
})

describe('prepareDataConsulta', () => {
  it('grava só a data (YYYY-MM-DD)', () => {
    expect(prepareDataConsulta(DateTime.fromISO('2026-10-15T14:30:00'))).toBe('2026-10-15')
  })

  it('lança erro como o Lucid quando a data é inválida', () => {
    expect(() => prepareDataConsulta(DateTime.fromISO('2026-02-30'))).toThrow(
      /Invalid value for "Agendamento.dataConsulta"/
    )
  })
})

describe('inicioDaConsulta', () => {
  it('interpreta data + horário no fuso de São Paulo (ignora sufixo de hora na data)', () => {
    const inicio = inicioDaConsulta('2026-10-15T00:00:00.000Z', '14:30')
    expect(inicio.zoneName).toBe(FUSO_CONSULTA)
    expect(inicio.toFormat('yyyy-MM-dd HH:mm')).toBe('2026-10-15 14:30')
    // São Paulo é UTC-3 (sem horário de verão)
    expect(inicio.toUTC().toFormat('HH:mm')).toBe('17:30')
  })
})

describe('prepareDateTimeString', () => {
  it('formata no padrão do dialeto MySQL', () => {
    const dt = DateTime.fromObject({ year: 2026, month: 1, day: 2, hour: 3, minute: 4, second: 5 })
    expect(prepareDateTimeString(dt)).toBe('2026-01-02 03:04:05')
  })
})

describe('podeSerCancelado', () => {
  it('aceita status ativos sem diferenciar maiúsculas', () => {
    for (const s of ['pendente', 'confirmado', 'agendado', 'marcado', 'CONFIRMADO']) {
      expect(podeSerCancelado(s)).toBe(true)
    }
  })

  it('recusa realizado, cancelado, vazio, null e undefined', () => {
    for (const s of ['realizado', 'cancelado', '', null, undefined]) {
      expect(podeSerCancelado(s)).toBe(false)
    }
  })
})

describe('jaPassou', () => {
  it('compara data + horário da consulta com o momento atual', () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2026, 9, 15, 12, 0))
    const dia = DateTime.fromObject({ year: 2026, month: 10, day: 15 })
    expect(jaPassou(dia, '11:59')).toBe(true)
    expect(jaPassou(dia, '12:30')).toBe(false)
    expect(jaPassou(dia.minus({ days: 1 }), '23:00')).toBe(true)
    expect(jaPassou(dia.plus({ days: 1 }), '00:00')).toBe(false)
  })

  it('devolve false quando faltam data ou horário (em vez de lançar)', () => {
    expect(jaPassou(null, '10:00')).toBe(false)
    expect(jaPassou(DateTime.now(), null)).toBe(false)
  })
})

describe('nomeCompleto', () => {
  it('junta nome e sobrenome e ignora sobrenome nulo', () => {
    expect(nomeCompleto({ nome: 'Ana', sobrenome: 'Souza' })).toBe('Ana Souza')
    expect(nomeCompleto({ nome: 'Ana', sobrenome: null })).toBe('Ana')
  })
})
