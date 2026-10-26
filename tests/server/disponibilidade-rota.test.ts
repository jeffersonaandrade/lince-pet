import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const prismaMock = vi.hoisted(() => ({ agendamento: { findMany: vi.fn() }, veterinario: { findUnique: vi.fn() }, veterinarioEndereco: { findMany: vi.fn() } }))
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
  prismaMock.agendamento.findMany.mockResolvedValue([{ id: 'reserva', dataConsulta: '2030-01-07', horarioConsulta: '10:00', inicioEm: null, fimEm: null, duracaoMin: 30, deslocamentoMin: 0 }])
  prismaMock.veterinario.findUnique.mockResolvedValue({ id: 'vet-1', userId: 'dono', atendePresencial: 1, duracaoPresencialMin: 30 })
  prismaMock.veterinarioEndereco.findMany.mockResolvedValue([{ horariosDisponibilidade: { segunda: ['09:00', '09:30', '10:00', '10:30'] } }])
  bloqueios.bloqueiosDoPeriodo.mockResolvedValue([])
})

describe('GET /api/agendamentos/disponibilidade/:veterinario_id', () => {
  it('consulta a agenda da pessoa e bloqueia ocupação e horários fora da grade', async () => {
    const res = await consultar('?data=2030-01-07')
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data).toBe('2030-01-07')
    expect(body.horarios_ocupados).toContain('10:00')
    expect(body.horarios_ocupados).toContain('08:00')
    expect(body.horarios_ocupados).not.toContain('09:30')
    expect(body.dia_bloqueado).toBe(false)
    expect(prismaMock.agendamento.findMany.mock.calls[0][0].where.AND[0]).toEqual({ OR: [{ veterinario: { userId: 'dono' } }, { prestador: { userId: 'dono' } }] })
    expect(res.headers.get('cache-control')).toContain('no-store')
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
