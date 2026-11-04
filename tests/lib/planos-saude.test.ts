import { describe, expect, it } from 'vitest'
import {
  exemploCategoriasPlano,
  incluirPlanosVinculados,
  normalizarPlanosClinicaInput,
  rotuloPlanoComCategorias,
} from '@/lib/planos-saude'

describe('planos-saude helpers', () => {
  it('planos inativos já vinculados continuam visíveis no formulário', () => {
    expect(
      incluirPlanosVinculados(
        [{ id: 'a', name: 'Ativo' }],
        [
          { id: 'a', name: 'Ativo' },
          { id: 'i', name: 'Antigo' },
        ]
      )
    ).toEqual([
      { id: 'a', name: 'Ativo' },
      { id: 'i', name: 'Antigo (inativo)' },
    ])
  })

  it('sugere categorias conhecidas por marca', () => {
    expect(exemploCategoriasPlano('Pet top')).toContain('Diamante')
    expect(exemploCategoriasPlano('Eupet')).toContain('Safety')
    expect(exemploCategoriasPlano('Outro')).toContain('categorias')
  })

  it('monta rótulo com categorias', () => {
    expect(rotuloPlanoComCategorias({ name: 'Pet top', categoriasAceitas: 'Diamante, Gold' })).toBe(
      'Pet top — Diamante, Gold'
    )
    expect(rotuloPlanoComCategorias({ name: 'Pet top', categoriasAceitas: '  ' })).toBe('Pet top')
  })

  it('normaliza payload legado e com categorias', () => {
    expect(normalizarPlanosClinicaInput(['a', 'b'])).toEqual([
      { id: 'a', categoriasAceitas: null },
      { id: 'b', categoriasAceitas: null },
    ])
    expect(
      normalizarPlanosClinicaInput([
        { id: 'a', categoriasAceitas: ' Diamante ' },
        { id: 'b', categorias_aceitas: 'Premium' },
      ])
    ).toEqual([
      { id: 'a', categoriasAceitas: 'Diamante' },
      { id: 'b', categoriasAceitas: 'Premium' },
    ])
  })
})
