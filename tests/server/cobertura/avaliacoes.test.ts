import { describe, it, expect, vi, beforeEach } from 'vitest'

const prismaMock = vi.hoisted(() => ({ avaliacao: { findMany: vi.fn() } }))
vi.mock('@/server/db', () => ({ prisma: prismaMock }))

import { media, listarAvaliacoes, serializarVeterinario, serializarClinica } from '@/server/services/avaliacoes'

const avaliacao = (extra: Record<string, unknown> = {}) =>
  ({
    id: 'av-1',
    estrelas: 5,
    comentario: 'Ótimo',
    estrelasClinica: 4,
    comentarioClinica: 'Boa clínica',
    tutor: { user: { nome: 'Ana', sobrenome: 'Lima' } },
    agendamento: {
      dataConsulta: '2026-03-15 10:00:00',
      horarioConsulta: '10:00',
      pet: { nome: 'Rex', fotoUrl: 'rex.jpg' },
    },
    ...extra,
  }) as never

beforeEach(() => vi.clearAllMocks())

describe('media', () => {
  it('média com 2 casas, nulos contam como 0', () => {
    expect(media([5, 4, 4])).toBe(4.33)
    expect(media([5, null])).toBe(2.5)
  })

  it('lista vazia: 0', () => {
    expect(media([])).toBe(0)
  })
})

describe('listarAvaliacoes', () => {
  it('por veterinário: filtra pelo vet, inclui tutor e agendamento, mais recentes primeiro', async () => {
    prismaMock.avaliacao.findMany.mockResolvedValueOnce([])
    await listarAvaliacoes({ veterinarioId: 'vet-1' })
    expect(prismaMock.avaliacao.findMany).toHaveBeenCalledWith({
      where: { veterinarioId: 'vet-1' },
      include: { tutor: { include: { user: true } }, agendamento: true },
      orderBy: { createdAt: 'desc' },
      take: undefined,
    })
  })

  it('por clínica: só avaliações com nota da clínica, com pet e limite', async () => {
    prismaMock.avaliacao.findMany.mockResolvedValueOnce([{ id: 'a' }])
    const res = await listarAvaliacoes({ clinicaId: 'cli-1' }, { comPet: true, limit: 5 })
    expect(res).toEqual([{ id: 'a' }])
    expect(prismaMock.avaliacao.findMany).toHaveBeenCalledWith({
      where: { clinicaId: 'cli-1', estrelasClinica: { not: null } },
      include: { tutor: { include: { user: true } }, agendamento: { include: { pet: true } } },
      orderBy: { createdAt: 'desc' },
      take: 5,
    })
  })
})

describe('serializarVeterinario', () => {
  it('formata data dd/MM/yyyy e resume o tutor; sem pet por padrão', () => {
    expect(serializarVeterinario(avaliacao())).toEqual({
      id: 'av-1',
      estrelas: 5,
      comentario: 'Ótimo',
      data: '15/03/2026',
      hora: '10:00',
      tutor: { nome: 'Ana', sobrenome: 'Lima' },
    })
  })

  it('com pet inclui nome e foto', () => {
    expect(serializarVeterinario(avaliacao(), true).pet).toEqual({ nome: 'Rex', foto_url: 'rex.jpg' })
  })

  it('data como Date também é formatada', () => {
    const a = avaliacao({ agendamento: { dataConsulta: new Date(2026, 0, 2, 12), horarioConsulta: '' } })
    const res = serializarVeterinario(a, true)
    expect(res.data).toBe('02/01/2026')
    expect(res.hora).toBeNull()
    expect(res.pet).toBeNull()
  })

  it('sem agendamento e sem user do tutor: campos nulos', () => {
    const res = serializarVeterinario(avaliacao({ agendamento: null, tutor: { user: null } }), true)
    expect(res).toMatchObject({ data: null, hora: null, tutor: null, pet: null })
  })

  it('tutor sem sobrenome e pet sem foto viram null', () => {
    const res = serializarVeterinario(
      avaliacao({
        tutor: { user: { nome: 'Ana' } },
        agendamento: { dataConsulta: '2026-03-15', horarioConsulta: '09:00', pet: { nome: 'Rex' } },
      }),
      true
    )
    expect(res.tutor).toEqual({ nome: 'Ana', sobrenome: null })
    expect(res.pet).toEqual({ nome: 'Rex', foto_url: null })
  })

  it('tutor ausente: null', () => {
    expect(serializarVeterinario(avaliacao({ tutor: null })).tutor).toBeNull()
  })

  it('data inválida vira "Invalid DateTime" (comportamento herdado do Lucid)', () => {
    const res = serializarVeterinario(avaliacao({ agendamento: { dataConsulta: 'lixo', horarioConsulta: null } }))
    expect(res.data).toBe('Invalid DateTime')
  })
})

describe('serializarClinica', () => {
  it('usa a nota e o comentário da clínica', () => {
    const res = serializarClinica(avaliacao())
    expect(res).toEqual({
      id: 'av-1',
      estrelasClinica: 4,
      comentarioClinica: 'Boa clínica',
      data: '15/03/2026',
      hora: '10:00',
      tutor: { nome: 'Ana', sobrenome: 'Lima' },
    })
    expect(res).not.toHaveProperty('estrelas')
  })

  it('com pet inclui o resumo do pet', () => {
    expect(serializarClinica(avaliacao(), true).pet).toEqual({ nome: 'Rex', foto_url: 'rex.jpg' })
  })
})
