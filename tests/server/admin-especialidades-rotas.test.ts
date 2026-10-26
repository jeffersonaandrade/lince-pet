import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { HttpError } from '@/server/http'

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(), listarEspecialidadesAdmin: vi.fn(), criarEspecialidadeAdmin: vi.fn(),
  atualizarEspecialidadeAdmin: vi.fn(), inativarEspecialidadeAdmin: vi.fn(), revalidatePath: vi.fn(),
}))
vi.mock('@/server/auth/session', () => ({ requireAdmin: mocks.requireAdmin }))
vi.mock('@/server/services/admin-especialidades', () => mocks)
vi.mock('next/cache', () => ({ revalidatePath: mocks.revalidatePath }))
import { GET, POST } from '@/app/api/admin/especialidades/route'
import { PUT, DELETE } from '@/app/api/admin/especialidades/[id]/route'

beforeEach(() => vi.resetAllMocks())
function chamar(method: 'GET' | 'POST' | 'PUT' | 'DELETE') {
  const req = new NextRequest('http://localhost/api/admin/especialidades/esp-1', {
    method, ...(method !== 'GET' ? { body: JSON.stringify({ nome: 'Cardio', ativo: true, revisao: 'r1' }), headers: { 'Content-Type': 'application/json' } } : {}),
  })
  return { GET, POST, PUT, DELETE }[method](req, { params: Promise.resolve({ id: 'esp-1' }) })
}
describe('permissões do CRUD de especialidades', () => {
  for (const method of ['GET', 'POST', 'PUT', 'DELETE'] as const) {
    it.each([401, 403])(`${method}: acesso %s não executa operações`, async status => {
      mocks.requireAdmin.mockRejectedValueOnce(new HttpError(status, { message: 'Acesso negado' }))
      expect((await chamar(method)).status).toBe(status)
      for (const op of [mocks.listarEspecialidadesAdmin, mocks.criarEspecialidadeAdmin, mocks.atualizarEspecialidadeAdmin, mocks.inativarEspecialidadeAdmin]) expect(op).not.toHaveBeenCalled()
    })
  }
  it('lista sem cache compartilhado', async () => {
    mocks.listarEspecialidadesAdmin.mockResolvedValueOnce([])
    const res = await chamar('GET')
    expect(res.headers.get('cache-control')).toBe('private, no-store')
    expect(await res.json()).toEqual([])
  })
  it.each(['POST', 'PUT', 'DELETE'] as const)('%s de admin invalida a página pública', async method => {
    expect((await chamar(method)).status).toBe(method === 'POST' ? 201 : 200)
    expect(mocks.revalidatePath).toHaveBeenCalledWith('/servicos')
  })
})
