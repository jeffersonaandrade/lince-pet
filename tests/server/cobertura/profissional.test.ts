import { describe, it, expect, vi, beforeEach } from 'vitest'

const prismaMock = vi.hoisted(() => ({
  veterinario: { findUnique: vi.fn() },
  prestador: { findUnique: vi.fn() },
}))
vi.mock('@/server/db', () => ({ prisma: prismaMock }))

import { carregarProfissional, profissionalDe } from '@/server/services/profissional'

const user = (nome: string, sobrenome: string | null = null) => ({ id: `u-${nome}`, nome, sobrenome }) as never

beforeEach(() => {
  vi.clearAllMocks()
})

describe('profissionalDe', () => {
  it('prestador: texto de serviço com o nome do tipo do catálogo', () => {
    const p = profissionalDe({ prestador: { user: user('Bia', 'Souza'), tipoServico: { nome: 'Banho e tosa' } } })
    expect(p).toMatchObject({ tipo: 'prestador', nome: 'Bia Souza', rotulo: 'Banho e tosa', atendimento: 'serviço' })
  })

  it('prestador sem user nem tipo: rótulos genéricos', () => {
    expect(profissionalDe({ prestador: {} })).toEqual({
      tipo: 'prestador',
      user: null,
      nome: 'Profissional',
      rotulo: 'Profissional pet',
      atendimento: 'serviço',
    })
  })

  it('prestador tem prioridade sobre veterinário (não é tratado como vet)', () => {
    const p = profissionalDe({ veterinario: { user: user('João') }, prestador: { user: user('Bia') } })
    expect(p.tipo).toBe('prestador')
    expect(p.nome).toBe('Bia')
  })

  it('veterinário: consulta com rótulo "Veterinário"', () => {
    expect(profissionalDe({ veterinario: { user: user('João', 'Lima') } })).toMatchObject({
      tipo: 'veterinario',
      nome: 'João Lima',
      rotulo: 'Veterinário',
      atendimento: 'consulta',
    })
  })

  it('sem vet com user cai no nome da clínica, e sem clínica em "Profissional"', () => {
    expect(profissionalDe({ veterinario: null, clinica: { nomeClinica: 'Clínica Centro' } })).toMatchObject({
      tipo: 'veterinario',
      user: null,
      nome: 'Clínica Centro',
    })
    expect(profissionalDe({}).nome).toBe('Profissional')
  })
})

describe('carregarProfissional', () => {
  it('com veterinarioId busca o vet com user e não consulta prestador', async () => {
    prismaMock.veterinario.findUnique.mockResolvedValueOnce({ id: 'v1', user: user('João') })
    const p = await carregarProfissional({ veterinarioId: 'v1' })
    expect(prismaMock.veterinario.findUnique).toHaveBeenCalledWith({ where: { id: 'v1' }, include: { user: true } })
    expect(prismaMock.prestador.findUnique).not.toHaveBeenCalled()
    expect(p).toMatchObject({ tipo: 'veterinario', nome: 'João' })
  })

  it('com prestadorId busca prestador com user e tipo de serviço', async () => {
    prismaMock.prestador.findUnique.mockResolvedValueOnce({ id: 'p1', user: user('Bia'), tipoServico: { nome: 'Passeador' } })
    const p = await carregarProfissional({ veterinarioId: null, prestadorId: 'p1' })
    expect(prismaMock.prestador.findUnique).toHaveBeenCalledWith({ where: { id: 'p1' }, include: { user: true, tipoServico: true } })
    expect(prismaMock.veterinario.findUnique).not.toHaveBeenCalled()
    expect(p).toMatchObject({ tipo: 'prestador', rotulo: 'Passeador' })
  })

  it('sem ids não consulta o banco e devolve profissional genérico', async () => {
    const p = await carregarProfissional({ veterinarioId: null })
    expect(prismaMock.veterinario.findUnique).not.toHaveBeenCalled()
    expect(prismaMock.prestador.findUnique).not.toHaveBeenCalled()
    expect(p).toMatchObject({ tipo: 'veterinario', user: null, nome: 'Profissional' })
  })
})
