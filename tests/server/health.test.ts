import { describe, it, expect, vi, beforeEach } from 'vitest'

const prismaMock = vi.hoisted(() => ({ $queryRaw: vi.fn() }))
vi.mock('@/server/db', () => ({ prisma: prismaMock }))

import { GET } from '@/app/api/health/route'

beforeEach(() => vi.clearAllMocks())

describe('GET /health', () => {
  it('responde 200 sem cache quando o banco responde', async () => {
    prismaMock.$queryRaw.mockResolvedValue([{ '?column?': 1 }])
    const res = await GET()
    expect(res.status).toBe(200)
    expect(res.headers.get('cache-control')).toBe('no-store')
    expect(await res.json()).toEqual({ status: 'ok' })
  })

  it('responde 503 sem detalhes quando o banco falha', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    prismaMock.$queryRaw.mockRejectedValue(new Error('connection refused em db.interno:5432'))
    const res = await GET()
    expect(res.status).toBe(503)
    expect(await res.json()).toEqual({ status: 'erro' })
  })

  it('responde 503 quando o banco não responde no tempo limite', async () => {
    vi.useFakeTimers()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    prismaMock.$queryRaw.mockReturnValue(new Promise(() => {}))
    const pendente = GET()
    await vi.advanceTimersByTimeAsync(3000)
    expect((await pendente).status).toBe(503)
    vi.useRealTimers()
  })
})
