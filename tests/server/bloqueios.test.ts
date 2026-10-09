import { describe, it, expect } from 'vitest'
import { DateTime } from 'luxon'
import {
  diaDaSemana,
  diaInteiroBloqueado,
  horariosBloqueadosNaData,
  isHorarioBloqueado,
  validarBloqueio,
} from '@/server/services/bloqueios'

const diaInteiro = { dataInicio: '2026-10-15', dataFim: '2026-10-15', horarios: null }
const soAlgunsHorarios = { dataInicio: '2026-10-16', dataFim: '2026-10-16', horarios: ['14:00', '15:00'] }
const semana = { dataInicio: '2026-10-20', dataFim: '2026-10-24', horarios: null }
const periodoParcial = { dataInicio: '2026-11-02', dataFim: '2026-11-06', horarios: ['08:00'] }

describe('bloqueios de agenda (regras puras)', () => {
  it('bloqueia o dia inteiro só na data informada, não no mesmo dia da semana seguinte', () => {
    expect(diaInteiroBloqueado([diaInteiro], '2026-10-15')).toBe(true)
    expect(isHorarioBloqueado([diaInteiro], '2026-10-15', '09:30')).toBe(true)
    expect(diaInteiroBloqueado([diaInteiro], '2026-10-22')).toBe(false)
    expect(isHorarioBloqueado([diaInteiro], '2026-10-22', '09:30')).toBe(false)
  })

  it('bloqueia só os horários escolhidos na data', () => {
    expect(diaInteiroBloqueado([soAlgunsHorarios], '2026-10-16')).toBe(false)
    expect(horariosBloqueadosNaData([soAlgunsHorarios], '2026-10-16')).toEqual(['14:00', '15:00'])
    expect(isHorarioBloqueado([soAlgunsHorarios], '2026-10-16', '14:00')).toBe(true)
    expect(isHorarioBloqueado([soAlgunsHorarios], '2026-10-16', '14:00:00')).toBe(true)
    expect(isHorarioBloqueado([soAlgunsHorarios], '2026-10-16', '16:00')).toBe(false)
  })

  it('período cobre todas as datas entre início e fim (inclusive)', () => {
    expect(diaInteiroBloqueado([semana], '2026-10-19')).toBe(false)
    expect(diaInteiroBloqueado([semana], '2026-10-20')).toBe(true)
    expect(diaInteiroBloqueado([semana], '2026-10-24')).toBe(true)
    expect(diaInteiroBloqueado([semana], '2026-10-25')).toBe(false)
    expect(isHorarioBloqueado([periodoParcial], '2026-11-04', '08:00')).toBe(true)
    expect(isHorarioBloqueado([periodoParcial], '2026-11-04', '09:00')).toBe(false)
  })

  it('recorrente vale só nos dias da semana escolhidos, a partir do início e até o fim (ou sem fim)', () => {
    // 2026-10-15 é quinta (4); 2026-10-22 e 2026-10-29 também
    const quintaTarde = {
      dataInicio: '2026-10-15', dataFim: null, recorrente: 1, diasSemana: [4], horarios: ['14:00', '14:30'],
    }
    expect(diaDaSemana('2026-10-15')).toBe(4)
    expect(isHorarioBloqueado([quintaTarde], '2026-10-08', '14:00')).toBe(false)
    expect(isHorarioBloqueado([quintaTarde], '2026-10-15', '14:00')).toBe(true)
    expect(isHorarioBloqueado([quintaTarde], '2027-03-04', '14:30')).toBe(true)
    expect(isHorarioBloqueado([quintaTarde], '2026-10-16', '14:00')).toBe(false)
    expect(isHorarioBloqueado([quintaTarde], '2026-10-22', '09:00')).toBe(false)

    const comFim = { ...quintaTarde, dataFim: '2026-10-22', horarios: null }
    expect(diaInteiroBloqueado([comFim], '2026-10-22')).toBe(true)
    expect(diaInteiroBloqueado([comFim], '2026-10-29')).toBe(false)
  })

  it('combina vários bloqueios na mesma data', () => {
    const outro = { dataInicio: '2026-10-16', dataFim: '2026-10-16', horarios: ['09:00'] }
    expect(horariosBloqueadosNaData([soAlgunsHorarios, outro], '2026-10-16')).toEqual(['09:00', '14:00', '15:00'])
  })
})

describe('validarBloqueio', () => {
  const amanha = DateTime.now().plus({ days: 1 }).toISODate()!

  it('usa data_inicio como data_fim e null como dia inteiro', async () => {
    await expect(validarBloqueio({ data_inicio: amanha })).resolves.toEqual({
      dataInicio: amanha,
      dataFim: amanha,
      recorrente: false,
      diasSemana: null,
      horarios: null,
      motivo: null,
    })
  })

  it('recorrente aceita sem data final, sem limite de 31 dias, e usa o dia da semana do início por padrão', async () => {
    const r = await validarBloqueio({ data_inicio: amanha, recorrente: true })
    expect(r.dataFim).toBeNull()
    expect(r.diasSemana).toEqual([diaDaSemana(amanha)])

    const longo = DateTime.now().plus({ days: 90 }).toISODate()!
    const r2 = await validarBloqueio({ data_inicio: amanha, data_fim: longo, recorrente: true, dias_semana: [4, 1, 1] })
    expect(r2.dataFim).toBe(longo)
    expect(r2.diasSemana).toEqual([1, 4])
  })

  it('normaliza e ordena horários', async () => {
    const r = await validarBloqueio({ data_inicio: amanha, horarios: ['15:00', '14:00', '14:00'] })
    expect(r.horarios).toEqual(['14:00', '15:00'])
  })

  it('recusa data passada, fim antes do início e período maior que 31 dias', async () => {
    const ontem = DateTime.now().minus({ days: 1 }).toISODate()!
    await expect(validarBloqueio({ data_inicio: ontem })).rejects.toMatchObject({ status: 422 })
    await expect(
      validarBloqueio({ data_inicio: amanha, data_fim: DateTime.now().toISODate() })
    ).rejects.toMatchObject({ status: 422 })
    await expect(
      validarBloqueio({ data_inicio: amanha, data_fim: DateTime.now().plus({ days: 40 }).toISODate() })
    ).rejects.toMatchObject({ status: 422 })
  })
})
