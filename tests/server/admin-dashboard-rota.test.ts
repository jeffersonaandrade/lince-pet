import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { HttpError } from '@/server/http'

const mocks = vi.hoisted(() => ({ requireAdmin: vi.fn(), consultarPainel: vi.fn() }))
vi.mock('@/server/auth/session', () => ({ requireAdmin: mocks.requireAdmin }))
vi.mock('@/server/services/admin-dashboard', () => ({ consultarPainel: mocks.consultarPainel }))
import { GET } from '@/app/api/admin/dashboard/route'

beforeEach(() => vi.clearAllMocks())
const request = () => GET(new NextRequest('http://localhost/api/admin/dashboard'), { params: Promise.resolve({}) })

describe('GET /api/admin/dashboard', () => {
  it.each([401, 403])('acesso %s não consulta o painel nem cache', async (status) => {
    mocks.requireAdmin.mockRejectedValueOnce(new HttpError(status, { message: 'Acesso negado' }))
    expect((await request()).status).toBe(status)
    expect(mocks.consultarPainel).not.toHaveBeenCalled()
  })

  it('admin recebe as contagens sem cache compartilhado HTTP', async () => {
    mocks.requireAdmin.mockResolvedValueOnce({ id: 'admin' })
    mocks.consultarPainel.mockResolvedValueOnce({ mes: '2026-10', filas: { crmv: 1 } })
    const res = await request()
    expect(res.status).toBe(200)
    expect(res.headers.get('cache-control')).toBe('private, no-store')
    expect(await res.json()).toEqual({ mes: '2026-10', filas: { crmv: 1 } })
  })
})
