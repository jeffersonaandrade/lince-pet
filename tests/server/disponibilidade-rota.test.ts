import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const prismaMock = vi.hoisted(() => ({ agendamento: { findMany: vi.fn() } }))
vi.mock('@/server/db', () => ({ prisma: prismaMock }))

vi.mock('@/server/auth/session', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/server/auth/session')>()),
  requireUser: vi.fn(async () => ({ id: 'u-1', userType: 'tutor' })),
}))

const bloqueios = vi.hoisted(() => ({ bloqueiosDoPeriodo: vi.fn() }))
vi.mock('@/server/services/bloqueios', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/server/services/bloqueios')>()),
  ...bloqueios,
}))

import { GET } from '@/app/api/agendamentos/disponibilidade/[veterinario_id]/route'

const ctx = { params: Promise.resolve({ veterinario_id: 'vet-1' }) }
const consultar = (query: string) =>
  GET(new NextRequest(`http://localhost/api/agendamentos/disponibilidade/vet-1${query}`), ctx)

beforeEach(() => {
  vi.clearAllMocks()
  prismaMock.agendamento.findMany.mockResolvedValue([{ horarioConsulta: '10:00' }])
  bloqueios.bloqueiosDoPeriodo.mockResolvedValue([])
})

describe('GET /api/agendamentos/disponibilidade/:veterinario_id', () => {
  it('data válida: consulta o dia em SQL e devolve os horários ocupados', async () => {
    const res = await consultar('?data=2026-10-20')
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({
      data: '2026-10-20',
      horarios_ocupados: ['10:00'],
      horarios_bloqueados: [],
      dia_bloqueado: false,
    })
    expect(prismaMock.agendamento.findMany.mock.calls[0][0].where).toEqual({
      veterinarioId: 'vet-1',
      dataConsulta: '2026-10-20',
      status: { in: ['pendente', 'confirmado'] },
    })
  })

  it.each([
    ['sem data', ''],
    ['data inválida', '?data=amanha'],
    ['data como filtro do Prisma', '?data[not]=x'],
  ])('%s: 400 sem consultar o banco', async (_caso, query) => {
    const res = await consultar(query)
    expect(res.status).toBe(400)
    expect(prismaMock.agendamento.findMany).not.toHaveBeenCalled()
  })
})
