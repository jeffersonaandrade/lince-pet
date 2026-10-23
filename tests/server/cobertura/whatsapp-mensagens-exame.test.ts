import { describe, it, expect } from 'vitest'
import { montarMensagem } from '@/server/services/whatsapp-mensagens'

const dados = {
  tutor: 'Ana',
  pet: 'Rex',
  profissional: 'Clínica Centro',
  data: '10/10/2026',
  hora: '14:00',
  local: 'Clínica Centro',
  exames: 'Hemograma, Raio-X',
  preparo: 'Hemograma: Jejum de 8h',
}

describe('WhatsApp de exame (só lembretes ao tutor)', () => {
  it('24h e 2h com exames, preparo e pagamento na clínica', () => {
    const amanha = montarMensagem('lembrete_24h', 'tutor', dados)!
    expect(amanha).toContain('o exame de Rex na Clínica Centro é amanhã')
    expect(amanha).toContain('🔬 Exames: Hemograma, Raio-X')
    expect(amanha).toContain('⚠️ Preparo: Hemograma: Jejum de 8h')
    expect(amanha).toContain('Pagamento na clínica')
    expect(montarMensagem('lembrete_2h', 'tutor', { ...dados, preparo: null })).not.toContain('Preparo')
    expect(montarMensagem('lembrete_2h', 'tutor', dados)).toContain('começa em cerca de 2 horas')
  })

  it('outros eventos e a clínica não recebem texto de exame', () => {
    expect(montarMensagem('confirmacao', 'tutor', dados)).toBeNull()
    expect(montarMensagem('lembrete_24h', 'profissional', dados)).toBeNull()
  })

  it('preparo com link é limpo', () => {
    expect(montarMensagem('lembrete_24h', 'tutor', { ...dados, preparo: 'veja www.golpe.com' })).toContain('[link removido]')
  })
})
