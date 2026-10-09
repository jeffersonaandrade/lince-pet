import { describe, it, expect } from 'vitest'
import { montarMensagem, type DadosMensagem, type EventoWhatsapp } from '@/server/services/whatsapp-mensagens'

const consulta: DadosMensagem = {
  tutor: 'Ana',
  pet: 'Rex',
  profissional: 'Dr(a). Bia',
  data: '20/10/2026',
  hora: '14:00',
  local: 'Clínica Centro',
}
const servico: DadosMensagem = { ...consulta, profissional: 'Carla', servico: 'Banho completo' }

const RODAPE_CONSULTA = 'avisos automáticos de consultas'
const RODAPE_SERVICO = 'avisos automáticos de pedidos'

describe('montarMensagem: consulta veterinária', () => {
  it('confirmação (tutor) traz os detalhes e o rodapé de opt-out', () => {
    const m = montarMensagem('confirmacao', 'tutor', consulta)!
    expect(m).toContain('Olá, Ana! Sua consulta com Dr(a). Bia está agendada.')
    expect(m).toContain('🐾 Pet: Rex')
    expect(m).toContain('📅 Data: 20/10/2026')
    expect(m).toContain('🕐 Hora: 14:00')
    expect(m).toContain('📍 Local: Clínica Centro')
    expect(m).toContain(RODAPE_CONSULTA)
  })

  it('lembretes 24h e 2h (tutor)', () => {
    expect(montarMensagem('lembrete_24h', 'tutor', consulta)).toContain('é amanhã')
    expect(montarMensagem('lembrete_2h', 'tutor', consulta)).toContain('começa em cerca de 2 horas')
  })

  it('cancelamento pelo profissional (tutor) com e sem motivo', () => {
    const sem = montarMensagem('cancelamento', 'tutor', consulta)!
    expect(sem).toContain('foi cancelada pelo profissional.')
    expect(sem).toContain('Você pode reagendar pela Lince Pet.')
    expect(sem).not.toContain('Motivo:')
    const com = montarMensagem('cancelamento', 'tutor', { ...consulta, motivo: 'Agenda bloqueada pelo profissional' })!
    expect(com).toContain('\nMotivo: Agenda bloqueada pelo profissional')
  })

  it('remarcação (tutor e profissional)', () => {
    expect(montarMensagem('remarcacao', 'tutor', consulta)).toContain('Sua consulta com Dr(a). Bia foi remarcada.')
    expect(montarMensagem('remarcacao', 'profissional', consulta)).toContain('Ana remarcou a consulta de Rex.')
  })

  it('profissional: novo agendamento e cancelamento pelo tutor, sem rodapé', () => {
    const novo = montarMensagem('novo_agendamento', 'profissional', consulta)!
    expect(novo).toContain('Nova consulta agendada por Ana.')
    expect(novo).not.toContain(RODAPE_CONSULTA)
    expect(montarMensagem('cancelamento', 'profissional', { ...consulta, motivo: 'imprevisto' })).toBe(
      'Olá, Dr(a). Bia. Ana cancelou a consulta de Rex em 20/10/2026 às 14:00.\nMotivo: imprevisto'
    )
  })

  it('eventos que não se aplicam ao destinatário devolvem null', () => {
    expect(montarMensagem('novo_agendamento', 'tutor', consulta)).toBeNull()
    for (const e of ['confirmacao', 'lembrete_24h', 'lembrete_2h'] as EventoWhatsapp[]) {
      expect(montarMensagem(e, 'profissional', consulta)).toBeNull()
    }
  })
})

describe('montarMensagem: pedido de prestador (texto de serviço)', () => {
  it('confirmação (tutor) fala de pedido aceito, sem "consulta" nem "Dr(a)."', () => {
    const m = montarMensagem('confirmacao', 'tutor', servico)!
    expect(m).toContain('Carla aceitou o pedido "Banho completo" para Rex.')
    expect(m).toContain('🛎️ Serviço: Banho completo')
    expect(m).toContain(RODAPE_SERVICO)
    expect(m).not.toMatch(/consulta|Dr\(a\)\./)
  })

  it('lembretes, cancelamento e remarcação (tutor)', () => {
    expect(montarMensagem('lembrete_24h', 'tutor', servico)).toContain('o serviço "Banho completo" de Rex com Carla é amanhã')
    expect(montarMensagem('lembrete_2h', 'tutor', servico)).toContain('começa em cerca de 2 horas')
    expect(montarMensagem('cancelamento', 'tutor', servico)).toContain('foi cancelado pelo profissional.' + '\n\n_Lince')
    expect(montarMensagem('cancelamento', 'tutor', { ...servico, motivo: 'chuva' })).toContain('\nMotivo: chuva')
    expect(montarMensagem('remarcacao', 'tutor', servico)).toContain('O pedido "Banho completo" com Carla foi remarcado.')
  })

  it('profissional: novo pedido, cancelamento e remarcação', () => {
    expect(montarMensagem('novo_agendamento', 'profissional', servico)).toContain(
      'Olá, Carla! Novo pedido de Ana: "Banho completo". Aceite ou recuse pela Lince Pet.'
    )
    expect(montarMensagem('cancelamento', 'profissional', servico)).toBe(
      'Olá, Carla. Ana cancelou o pedido "Banho completo" de Rex em 20/10/2026 às 14:00.'
    )
    expect(montarMensagem('remarcacao', 'profissional', servico)).toContain('Ana remarcou o pedido "Banho completo" de Rex.')
  })

  it('eventos que não se aplicam devolvem null', () => {
    expect(montarMensagem('novo_agendamento', 'tutor', servico)).toBeNull()
    expect(montarMensagem('confirmacao', 'profissional', servico)).toBeNull()
    expect(montarMensagem('lembrete_2h', 'profissional', servico)).toBeNull()
  })
})
