import { describe, expect, it } from 'vitest'
import { cartaoDePlano, PLANOS_CLINICA, PLANOS_PRESTADOR, PLANOS_VETERINARIO } from '@/config/planos'

describe('oferta da v1 sem promessa de WhatsApp', () => {
  it('planos individuais e de clínica não anunciam o recurso adiado', () => {
    for (const plano of [...PLANOS_VETERINARIO,...PLANOS_PRESTADOR,...PLANOS_CLINICA]) {
      expect(plano.benefits.join(' ')).not.toMatch(/whatsapp/i)
    }
  })
  it('feature do catálogo legado não reaparece no fallback nem como código técnico', () => {
    const card = cartaoDePlano({code:'legado',name:'Legado',priceCents:5990,features:['whatsapp_notifications','basic_dashboard']})
    expect(card.benefits).toEqual(['Dashboard de métricas básico'])
  })
})
