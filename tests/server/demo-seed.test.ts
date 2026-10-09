import { describe, expect, it } from 'vitest'
import { especialidadesVeterinarias } from '@/data/especialidades'
import { CLINICAS, PETS, PRESTADORES, TUTORES, VETERINARIOS } from '../../prisma/demo'
import { TIPOS_SERVICO } from '../../prisma/catalogo'

describe('seed de demonstração', () => {
  it('espalha tutores, veterinários e clínicas por cidades e planos diferentes', () => {
    expect(new Set(TUTORES.map((item) => item.estado)).size).toBeGreaterThanOrEqual(8)
    expect(new Set(TUTORES.map((item) => item.email)).size).toBe(TUTORES.length)
    expect(TUTORES.some((item) => item.whatsappOptIn === 0)).toBe(true)

    const planosVet = new Set(VETERINARIOS.map((item) => item.planCode))
    expect(planosVet).toEqual(new Set(['pro', 'pro_plus']))
    expect(VETERINARIOS.some((item) => item.atendeOnline)).toBe(true)
    expect(VETERINARIOS.some((item) => !item.atendeOnline)).toBe(true)
    expect(VETERINARIOS.some((item) => item.atendeDomicilio)).toBe(true)

    expect(new Set(CLINICAS.map((item) => item.planCode))).toEqual(new Set(['starter', 'clinic', 'clinic_pro']))
    expect(new Set(CLINICAS.map((item) => item.tipoClinica)).size).toBe(2)
  })

  it('só usa especialidades oficiais e dá pets a cada tutor', () => {
    const oficiais = new Set(especialidadesVeterinarias)
    const usadas = [...VETERINARIOS, ...CLINICAS].flatMap((item) => item.especialidades)
    expect(usadas.filter((nome) => !oficiais.has(nome))).toEqual([])
    for (const tutor of TUTORES) {
      expect(PETS[tutor.email]?.length).toBeGreaterThan(0)
    }
  })

  it('tem um prestador de cada tipo do catálogo, com serviços coerentes com a modalidade', () => {
    expect(new Set(PRESTADORES.map((p) => p.tipo))).toEqual(new Set(TIPOS_SERVICO.map((t) => t.slug)))
    expect(PRESTADORES.every((p) => p.email.includes('mockup'))).toBe(true)
    for (const p of PRESTADORES) {
      const modalidade = TIPOS_SERVICO.find((t) => t.slug === p.tipo)!.modalidade
      expect(p.servicos.length).toBeGreaterThan(0)
      for (const s of p.servicos) {
        if (modalidade === 'duracao') expect(s.duracaoMin).toBeGreaterThan(0)
        else expect(s.duracaoMin ?? null).toBeNull()
      }
    }
  })
})
