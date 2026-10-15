import { describe, expect, it } from 'vitest'
import {
  agruparPorAno,
  classeStatus,
  classificarAgendamentos,
  consultaConcluida,
  gradeDoAgendamento,
  horariosParaReagendar,
  rotuloStatus,
} from '@/lib/agenda-tutor'
import type { DisponibilidadeResponse } from '@/services/agendamentos/agendamentos'

const livre: DisponibilidadeResponse = { data: '', horarios_ocupados: [] }

describe('classificarAgendamentos', () => {
  it('pendente, confirmado e em andamento ficam em Próximas; o resto vai para o histórico', () => {
    const lista = ['pendente', 'Confirmado', 'em andamento', 'realizado', 'cancelado', 'reagendado', 'recusado'].map(
      (status, i) => ({ id: String(i), status })
    )
    const { proximas, historico } = classificarAgendamentos(lista)

    expect(proximas.map((a) => a.status)).toEqual(['pendente', 'Confirmado', 'em andamento'])
    expect(historico.map((a) => a.status)).toEqual(['realizado', 'cancelado', 'reagendado', 'recusado'])
  })

  it('status desconhecido ou vazio não some: vai para o histórico', () => {
    const { proximas, historico } = classificarAgendamentos([{ status: 'aguardando_pagamento' }, { status: '' }])
    expect(proximas).toEqual([])
    expect(historico).toHaveLength(2)
  })
})

describe('status da consulta', () => {
  it('consultaConcluida reconhece as grafias de concluída e nada mais', () => {
    expect(['realizado', 'concluido', 'Concluida'].every(consultaConcluida)).toBe(true)
    expect(['confirmado', 'em andamento', '', null, undefined].some(consultaConcluida)).toBe(false)
  })

  it('rótulo amigável, com o status cru como último recurso', () => {
    expect(rotuloStatus('pendente')).toBe('Aguardando')
    expect(rotuloStatus('realizado')).toBe('Concluída')
    expect(rotuloStatus('EM ANDAMENTO')).toBe('Em andamento')
    expect(rotuloStatus('recusado')).toBe('Recusado')
    expect(rotuloStatus('outro_status')).toBe('outro_status')
    expect(rotuloStatus(null)).toBe('')
  })

  it('classe CSS em kebab-case', () => {
    expect(classeStatus('Em Andamento')).toBe('status-em-andamento')
    expect(classeStatus('pendente')).toBe('status-pendente')
  })
})

describe('agruparPorAno', () => {
  it('agrupa por ano (DD/MM/YYYY ou ISO), do mais recente ao mais antigo, com data inválida por último', () => {
    const grupos = agruparPorAno([
      { id: 'a', data_consulta: '10/03/2024' },
      { id: 'b', data_consulta: '' },
      { id: 'c', data_consulta: '2026-01-05' },
      { id: 'd', data_consulta: '01/12/2024' },
    ])
    expect(grupos.map((g) => [g.ano, g.itens.map((i) => i.id)])).toEqual([
      ['2026', ['c']],
      ['2024', ['a', 'd']],
      ['Anteriores', ['b']],
    ])
  })
})

describe('gradeDoAgendamento', () => {
  const agenda = {
    availability: { 'Segunda-feira': ['09:00', '10:00'] },
    horariosOnline: '{"terça": ["20:00"]}',
    locations: [
      { id: 'end-1', clinicaId: 'cli-1', availability: { quarta: ['14:00'] } },
      { id: 'end-2', clinicaId: 'cli-2', availability: {} },
    ],
  }
  const base = { data_consulta: '', horario_consulta: '' }

  it('consulta online usa a grade online (mesmo vinda como JSON em texto e com acento)', () => {
    expect(gradeDoAgendamento(agenda, { ...base, tipo_consulta: 'online', clinica_id: null })).toEqual({ terca: ['20:00'] })
  })

  it('online sem grade própria cai na grade padrão do vet', () => {
    const semOnline = { ...agenda, horariosOnline: null }
    expect(gradeDoAgendamento(semOnline, { ...base, tipo_consulta: 'online', clinica_id: null })).toEqual({
      segunda: ['09:00', '10:00'],
    })
  })

  it('presencial encontra o local pelo id da clínica, não só pelo id do endereço', () => {
    expect(gradeDoAgendamento(agenda, { ...base, tipo_consulta: 'presencial', clinica_id: 'cli-1' })).toEqual({
      quarta: ['14:00'],
    })
  })

  it('local sem horários próprios usa a grade padrão do vet', () => {
    expect(gradeDoAgendamento(agenda, { ...base, tipo_consulta: 'presencial', clinica_id: 'cli-2' })).toEqual({
      segunda: ['09:00', '10:00'],
    })
  })

  it('local desconhecido ou consulta sem clínica usam a grade padrão', () => {
    const padrao = { segunda: ['09:00', '10:00'] }
    expect(gradeDoAgendamento(agenda, { ...base, tipo_consulta: 'presencial', clinica_id: 'x' })).toEqual(padrao)
    expect(gradeDoAgendamento(agenda, { ...base, tipo_consulta: 'domicilio', clinica_id: null })).toEqual(padrao)
  })
})

describe('horariosParaReagendar', () => {
  // 2026-10-19 é uma segunda-feira.
  const grade = { segunda: ['11:00', '09:00', '10:00', '09:00'] }
  const consulta = { tipo_consulta: 'presencial', clinica_id: null, data_consulta: '19/10/2026', horario_consulta: '10:00:00' }
  const longeDeHoje = new Date(2026, 0, 1, 8, 0)

  it('devolve a grade do dia ordenada e sem duplicados', () => {
    const r = horariosParaReagendar({ grade, agendamento: consulta, data: '2026-10-26', disponibilidade: livre, agora: longeDeHoje })
    expect(r).toEqual(['09:00', '10:00', '11:00'])
  })

  it('tira horários ocupados (mesmo com segundos) e bloqueados', () => {
    const r = horariosParaReagendar({
      grade,
      agendamento: consulta,
      data: '2026-10-26',
      disponibilidade: { data: '2026-10-26', horarios_ocupados: ['09:00:00'], horarios_bloqueados: ['11:00'] },
      agora: longeDeHoje,
    })
    expect(r).toEqual(['10:00'])
  })

  it('na mesma data, o horário da própria consulta continua disponível', () => {
    const r = horariosParaReagendar({
      grade,
      agendamento: consulta,
      data: '2026-10-19',
      disponibilidade: { data: '2026-10-19', horarios_ocupados: ['10:00', '11:00'] },
      agora: longeDeHoje,
    })
    expect(r).toEqual(['09:00', '10:00'])
  })

  it('o horário da própria consulta sai se o profissional bloqueou', () => {
    const r = horariosParaReagendar({
      grade,
      agendamento: consulta,
      data: '2026-10-19',
      disponibilidade: { data: '2026-10-19', horarios_ocupados: ['10:00'], horarios_bloqueados: ['10:00'] },
      agora: longeDeHoje,
    })
    expect(r).toEqual(['09:00', '11:00'])
  })

  it('em outra data, o mesmo horário ocupado não é liberado', () => {
    const r = horariosParaReagendar({
      grade,
      agendamento: consulta,
      data: '2026-10-26',
      disponibilidade: { data: '2026-10-26', horarios_ocupados: ['10:00'] },
      agora: longeDeHoje,
    })
    expect(r).toEqual(['09:00', '11:00'])
  })

  it('dia bloqueado, data inválida ou dia sem grade não têm horários', () => {
    const args = { grade, agendamento: consulta, agora: longeDeHoje }
    expect(horariosParaReagendar({ ...args, data: '2026-10-26', disponibilidade: { ...livre, dia_bloqueado: true } })).toEqual([])
    expect(horariosParaReagendar({ ...args, data: 'xx', disponibilidade: livre })).toEqual([])
    expect(horariosParaReagendar({ ...args, data: '2026-10-27', disponibilidade: livre })).toEqual([])
  })

  it('hoje, horários que já passaram (ou estão passando) não aparecem', () => {
    const r = horariosParaReagendar({
      grade,
      agendamento: consulta,
      data: '2026-10-26',
      disponibilidade: livre,
      agora: new Date(2026, 9, 26, 10, 0),
    })
    expect(r).toEqual(['11:00'])
  })
})
