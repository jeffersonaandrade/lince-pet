import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
const state = vi.hoisted(() => ({ findFirst: vi.fn(), cancelarAssinaturas: vi.fn() }))
vi.mock('@/server/db', () => ({ prisma: { subscription: { findFirst: state.findFirst } } }))
vi.mock('@/server/auth/session', () => ({ requireUser: vi.fn(async () => ({ userType: 'veterinario', veterinario: { id: 'v1', subscriptionPlanCode: 'vet_pro' } })) }))
vi.mock('@/server/services/assinaturas', () => ({ cancelarAssinaturas: state.cancelarAssinaturas }))
import { DELETE } from '@/app/api/assinaturas/[id]/route'
const call = () => DELETE(new NextRequest('http://localhost/api/assinaturas/s1', { method: 'DELETE' }), { params: Promise.resolve({ id: 's1' }) })
beforeEach(() => vi.resetAllMocks())
describe('DELETE assinatura', () => {
  it('recusa id alheio sem iniciar cancelamento', async () => {
    state.findFirst.mockResolvedValue(null)
    expect((await call()).status).toBe(404)
    expect(state.findFirst).toHaveBeenCalledWith({ where: { id: 's1', veterinarioId: 'v1' }, select: { id: true } })
    expect(state.cancelarAssinaturas).not.toHaveBeenCalled()
  })
  it.each([[true, 202], [false, 200]])('pendente=%s responde HTTP %i', async (pending, status) => {
    state.findFirst.mockResolvedValue({ id: 's1' })
    state.cancelarAssinaturas.mockResolvedValue({ cancelamentoPendente: pending, message: 'situação' })
    const response = await call()
    expect(response.status).toBe(status)
    expect(await response.json()).toMatchObject({ cancelamentoPendente: pending })
  })
})
