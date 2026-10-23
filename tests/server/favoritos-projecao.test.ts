import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const prismaMock = vi.hoisted(() => ({ tutor: { findFirst: vi.fn() } }))
vi.mock('@/server/db', () => ({ prisma: prismaMock }))

const sessao = vi.hoisted(() => ({ requireUser: vi.fn() }))
vi.mock('@/server/auth/session', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/server/auth/session')>()),
  ...sessao,
}))

import { GET } from '@/app/api/favorites/route'

beforeEach(() => {
  vi.clearAllMocks()
  sessao.requireUser.mockResolvedValue({ id: 'u-t', userType: 'tutor' })
})

describe('GET /api/favorites', () => {
  it('só busca nome, foto e cidade dos profissionais favoritados', async () => {
    prismaMock.tutor.findFirst.mockResolvedValue({ favorites: [] })

    const res = await GET(new NextRequest('http://localhost/api/favorites'), { params: Promise.resolve({}) })

    expect(res.status).toBe(200)
    const { select } = prismaMock.tutor.findFirst.mock.calls[0][0]
    const { veterinario, clinica } = select.favorites.select
    expect(veterinario.select).toEqual({
      id: true,
      fotoUrl: true,
      user: { select: { nome: true } },
      enderecos: { select: { cidade: true, estado: true } },
    })
    expect(clinica.select).toEqual({
      id: true,
      nomeClinica: true,
      fotoPerfil: true,
      cidade: true,
      estado: true,
      user: { select: { nome: true } },
    })
  })

  it('sem perfil de tutor responde 404', async () => {
    prismaMock.tutor.findFirst.mockResolvedValue(null)
    const res = await GET(new NextRequest('http://localhost/api/favorites'), { params: Promise.resolve({}) })
    expect(res.status).toBe(404)
  })
})
