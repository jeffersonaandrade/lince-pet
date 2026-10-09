import { describe, expect, it } from 'vitest'
import { especialidadesVeterinarias } from '@/data/especialidades'
import { DIFERENCIAIS, PLANOS_ASSINATURA, PLANOS_SAUDE } from '../../prisma/catalogo'

describe('catálogo do prisma/seed', () => {
  it('traz os planos de assinatura com preço, limite e feature de WhatsApp', () => {
    const porCodigo = new Map(PLANOS_ASSINATURA.map((plan) => [plan.code, plan]))
    expect([...porCodigo.keys()].sort()).toEqual([
      'clinic',
      'clinic_pro',
      'free',
      'pro',
      'pro_plus',
      'starter',
      'vet_pro',
      'vet_starter',
    ])

    const free = porCodigo.get('free')
    expect(free?.priceCents).toBe(0)
    expect(free?.monthlyAppointmentLimit).toBe(10)
    expect(free?.targetType).toBe('veterinario')

    const pro = porCodigo.get('pro')
    expect(pro?.priceCents).toBe(5900)
    expect(pro?.monthlyAppointmentLimit).toBeNull()
    expect(pro?.features).toContain('whatsapp_notifications')
    expect(pro?.trialDays).toBe(14)

    expect(porCodigo.get('vet_starter')?.priceCents).toBe(3990)
    expect(porCodigo.get('vet_pro')?.priceCents).toBe(5990)
    expect(porCodigo.get('pro_plus')?.active).toBe(0)
    expect(porCodigo.get('starter')).toMatchObject({ name: 'Pequena', priceCents: 9990, maxVeterinarios: 5 })
    expect(porCodigo.get('clinic')).toMatchObject({ name: 'Média', priceCents: 14990, maxVeterinarios: 15 })
    expect(porCodigo.get('clinic_pro')).toMatchObject({ name: 'Grande', priceCents: 21990, maxVeterinarios: null })
    expect(porCodigo.get('vet_pro')?.features).toContain('featured_search')
  })

  it('reusa a lista oficial de especialidades e os nomes do mockup', () => {
    expect(especialidadesVeterinarias).toContain('Clínica Médica de Pequenos Animais')
    expect(especialidadesVeterinarias.length).toBeGreaterThan(20)
    expect(PLANOS_SAUDE).toContain('Porto Seguro Pet')
    expect(DIFERENCIAIS.map((item) => item.nome)).toContain('Atendimento 24h')
  })
})
