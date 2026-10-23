import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { HttpError } from '@/server/http'

const mocks = vi.hoisted(() => ({ requireAdmin: vi.fn(), consultarCapacidade: vi.fn() }))
vi.mock('@/server/auth/session', () => ({ requireAdmin: mocks.requireAdmin }))
vi.mock('@/server/services/admin-capacidade', () => ({ consultarCapacidade: mocks.consultarCapacidade }))
import { GET } from '@/app/api/admin/capacidade/route'

beforeEach(() => vi.clearAllMocks())
const request = () => GET(new NextRequest('http://localhost/api/admin/capacidade'), { params: Promise.resolve({}) })

describe('GET /api/admin/capacidade', () => {
  it.each([401, 403])('acesso %s não consulta métricas nem cache', async (status) => {
    mocks.requireAdmin.mockRejectedValueOnce(new HttpError(status, { message: 'Acesso negado' }))
    expect((await request()).status).toBe(status)
    expect(mocks.consultarCapacidade).not.toHaveBeenCalled()
  })
  it('admin recebe as métricas sem cache compartilhado HTTP', async () => {
    mocks.requireAdmin.mockResolvedValueOnce({ id: 'admin' })
    mocks.consultarCapacidade.mockResolvedValueOnce({ consultadoEm: '2026-10-23T12:00:00Z' })
    const res = await request()
    expect(res.status).toBe(200)
    expect(res.headers.get('cache-control')).toBe('private, no-store')
    expect(await res.json()).toEqual({ consultadoEm: '2026-10-23T12:00:00Z' })
  })
})
