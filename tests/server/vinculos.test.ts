import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const prismaMock = vi.hoisted(() => ({
  veterinario: { findFirst: vi.fn() },
  veterinarioClinica: { findFirst: vi.fn(), deleteMany: vi.fn(), updateMany: vi.fn() },
  clinica: { findUnique: vi.fn() },
  user: { findFirst: vi.fn() },
  tutor: { findFirst: vi.fn() },
  agendamento: { findFirst: vi.fn() },
  avaliacao: { findFirst: vi.fn(), create: vi.fn() },
  $transaction: vi.fn(),
}))
vi.mock('@/server/db', () => ({ prisma: prismaMock }))

const notificacoes = vi.hoisted(() => ({ notifyClinicLinkResponse: vi.fn(), notifyNewReviewToVet: vi.fn() }))
vi.mock('@/server/services/in-app-notifications', () => ({ inAppNotifications: notificacoes }))

const sessao = vi.hoisted(() => ({ user: {} as Record<string, unknown> }))
vi.mock('@/server/auth/session', () => ({ requireUser: vi.fn(async () => sessao.user) }))

import { aceitarVinculo, recusarVinculo } from '@/server/services/vinculos'
import { PATCH as recusarRoute } from '@/app/api/veterinarios/vinculos/[clinicaId]/recusar/route'
import { PATCH as aceitarRoute } from '@/app/api/veterinarios/vinculos/[clinicaId]/aceitar/route'
import { POST as avaliarRoute } from '@/app/api/agendamentos/[id]/avaliacao/route'

const vetUser = { id: 'u-vet', nome: 'Ana', sobrenome: 'Vet', userType: 'veterinario' }
const params = <T,>(p: T) => ({ params: Promise.resolve(p) })
const patch = () => new NextRequest('http://localhost/api/x', { method: 'PATCH' })

beforeEach(() => {
  vi.clearAllMocks()
  sessao.user = vetUser
  prismaMock.veterinario.findFirst.mockResolvedValue({ id: 'vet-1' })
  prismaMock.veterinarioClinica.findFirst.mockResolvedValue({ id: 'pivot-1' })
  prismaMock.clinica.findUnique.mockResolvedValue({ id: 'cli-1', userId: 'u-cli', nomeClinica: 'Clínica' })
  prismaMock.user.findFirst.mockResolvedValue({ id: 'u-cli' })
})

describe('vínculos: usuário sem perfil de veterinário', () => {
  it('service rejeita com 404', async () => {
    prismaMock.veterinario.findFirst.mockResolvedValue(null)
    await expect(recusarVinculo(vetUser as never, 'cli-1')).rejects.toMatchObject({ status: 404 })
    await expect(aceitarVinculo(vetUser as never, 'cli-1')).rejects.toMatchObject({ status: 404 })
  })

  it('rotas respondem 404 (não 500)', async () => {
    prismaMock.veterinario.findFirst.mockResolvedValue(null)
    expect((await recusarRoute(patch(), params({ clinicaId: 'cli-1' }))).status).toBe(404)
    expect((await aceitarRoute(patch(), params({ clinicaId: 'cli-1' }))).status).toBe(404)
  })
})

describe('recusar vínculo', () => {
  it('clínica inexistente: 404 e o vínculo não é apagado', async () => {
    prismaMock.clinica.findUnique.mockResolvedValue(null)
    const res = await recusarRoute(patch(), params({ clinicaId: 'cli-x' }))
    expect(res.status).toBe(404)
    expect(prismaMock.veterinarioClinica.deleteMany).not.toHaveBeenCalled()
  })

  it('caminho feliz: apaga o vínculo e avisa a clínica', async () => {
    await expect(recusarVinculo(vetUser as never, 'cli-1')).resolves.toBe(true)
    expect(prismaMock.veterinarioClinica.deleteMany).toHaveBeenCalledWith({
      where: { veterinarioId: 'vet-1', clinicaId: 'cli-1' },
    })
    expect(notificacoes.notifyClinicLinkResponse).toHaveBeenCalledWith(expect.objectContaining({ aceito: false }))
  })

  it('aceitar com clínica inexistente não abre transação', async () => {
    prismaMock.veterinarioClinica.findFirst.mockResolvedValue({ id: 'pivot-1', status: 'pendente' })
    prismaMock.clinica.findUnique.mockResolvedValue(null)
    await expect(aceitarVinculo(vetUser as never, 'cli-x')).rejects.toMatchObject({ status: 404 })
    expect(prismaMock.$transaction).not.toHaveBeenCalled()
  })
})

describe('avaliação', () => {
  it('dados inválidos respondem 422', async () => {
    sessao.user = { id: 'u-tutor', nome: 'T', userType: 'tutor' }
    const req = new NextRequest('http://localhost/api/agendamentos/ag-1/avaliacao', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ estrelas: 9 }),
    })
    const res = await avaliarRoute(req, params({ id: 'ag-1' }))
    expect(res.status).toBe(422)
    expect(prismaMock.avaliacao.create).not.toHaveBeenCalled()
  })
})
