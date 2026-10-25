import { describe, expect, it } from 'vitest'
import { horarioCanonico } from '@/server/services/agenda-lock'

describe('horário de agendamento precisa ser canônico antes de reservar vaga', () => {
  it.each(['00:00', '09:00', '23:59'])('aceita %s', horario => expect(horarioCanonico(horario)).toBe(true))
  it.each(['9:00', '24:00', '12:60', '09:00 ', '09:00:00', 'amanhã'])('recusa %s', horario => expect(horarioCanonico(horario)).toBe(false))
})
