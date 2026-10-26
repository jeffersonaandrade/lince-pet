import { describe, expect, it, vi } from 'vitest'
import { DateTime } from 'luxon'
import { intervalosConflitam, modalidadeConsulta } from '@/domain/agenda'
vi.mock('@/server/db', () => ({ prisma: {} }))
import { cabeNaGrade, intervaloDaReserva, periodoDaConsulta } from '@/server/services/agenda-profissional'
import { validarAgendaConfig } from '@/server/services/agenda-config'

const minutos = (h: number, m = 0) => (h * 60 + m) * 60_000
const periodo = (de: number, ate: number, deslocamentoMin = 0) => ({ inicio: de, fim: ate, deslocamentoMin })
describe('ocupação e deslocamento da pessoa', () => {
  const domiciliar = periodo(minutos(15), minutos(16), 40)
  it('recusa sobreposição parcial e o tempo de saída', () => {
    expect(intervalosConflitam(domiciliar, periodo(minutos(15, 30), minutos(16, 30)))).toBe(true)
    expect(intervalosConflitam(domiciliar, periodo(minutos(16, 30), minutos(17)))).toBe(true)
  })
  it('libera exatamente 40 minutos depois e não duplica dois deslocamentos', () => {
    expect(intervalosConflitam(domiciliar, periodo(minutos(16, 40), minutos(17, 40), 40))).toBe(false)
    expect(intervalosConflitam(domiciliar, periodo(minutos(16, 39), minutos(17, 39), 40))).toBe(true)
  })
  it('reserva o tempo de chegada', () => {
    expect(intervalosConflitam(domiciliar, periodo(minutos(13, 30), minutos(14, 30)))).toBe(true)
    expect(intervalosConflitam(domiciliar, periodo(minutos(13, 20), minutos(14, 20)))).toBe(false)
  })
  it('usa o maior dos intervalos exigidos pelos dois atendimentos', () => {
    expect(intervalosConflitam(domiciliar, periodo(minutos(16, 40), minutos(17, 40), 60))).toBe(true)
  })
  it('sem deslocamento aceita consultas consecutivas e recusa simultâneas', () => {
    expect(intervalosConflitam(periodo(0, 30), periodo(30, 60))).toBe(false)
    expect(intervalosConflitam(periodo(0, 30), periodo(29, 60))).toBe(true)
  })
  it('não depende da ordem dos perfis', () => {
    const outro = periodo(minutos(16, 30), minutos(17))
    expect(intervalosConflitam(outro, domiciliar)).toBe(intervalosConflitam(domiciliar, outro))
  })
  it('recusa modalidade arbitrária', () => expect(modalidadeConsulta('presencial-outra')).toBeNull())
})

describe('duração e grade', () => {
  const inicio = DateTime.fromISO('2030-01-07T15:00', { zone: 'America/Sao_Paulo' })
  it('exige todos os blocos da consulta', () => {
    expect(cabeNaGrade({ segunda: ['15:00'] }, inicio, inicio.plus({ minutes: 60 }))).toBe(false)
    expect(cabeNaGrade({ segunda: ['15:00', '15:30'] }, inicio, inicio.plus({ minutes: 60 }))).toBe(true)
  })
  it('guarda a duração e o deslocamento da modalidade', () => {
    const p = periodoDaConsulta({ duracaoDomicilioMin: 60, deslocamentoMin: 40 } as never, '2030-01-07', '15:00', 'domicilio')
    expect(p.fim.toFormat('HH:mm')).toBe('16:00')
    expect(p.deslocamentoMin).toBe(40)
  })
  it('interpreta registros antigos como 30 minutos sem deslocamento', () => {
    const p = intervaloDaReserva({ id: 'legado', dataConsulta: '2030-01-07', horarioConsulta: '15:00', inicioEm: null, fimEm: null })!
    expect(p.fim - p.inicio).toBe(30 * 60_000)
    expect(p.deslocamentoMin).toBe(0)
  })
  it('intervalo persistido não muda quando muda a configuração', () => {
    const p = intervaloDaReserva({ id: 'novo', dataConsulta: null, horarioConsulta: null, inicioEm: inicio.toJSDate(), fimEm: inicio.plus({ minutes: 60 }).toJSDate(), duracaoMin: 30, deslocamentoMin: 40 })!
    expect(p.fim - p.inicio).toBe(60 * 60_000)
  })
})
const valido = { duracaoPresencialMin: 30, duracaoOnlineMin: 45, duracaoDomicilioMin: 60, deslocamentoMin: 40, atendeDomicilio: true, precoConsultaDomicilio: 150, horariosDomicilio: { segunda: ['15:00', '15:30'] } }
describe('configuração validada', () => {
  it('aceita configuração por modalidade', () => expect(validarAgendaConfig(valido)).toMatchObject({ duracaoOnlineMin: 45, deslocamentoMin: 40 }))
  it.each([0, 25, 30, 240])('aceita deslocamento de %i minutos sem mínimo fixo de 40', deslocamentoMin => {
    expect(validarAgendaConfig({ ...valido, deslocamentoMin }).deslocamentoMin).toBe(deslocamentoMin)
  })
  it.each([{ deslocamentoMin: -1 }, { duracaoDomicilioMin: 0 }, { duracaoOnlineMin: 1000 }, { precoConsultaDomicilio: 0 }, { horariosDomicilio: {} }, { horariosDomicilio: { segunda: ['15:10'] } }])('recusa configuração inválida %#', alteracao => {
    expect(() => validarAgendaConfig({ ...valido, ...alteracao })).toThrow()
  })
})
