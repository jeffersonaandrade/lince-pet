import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const prismaMock = vi.hoisted(() => ({
  veterinario: { delete: vi.fn() },
  veterinarioClinica: { findMany: vi.fn(), deleteMany: vi.fn(), count: vi.fn() },
  clinica: { findUnique: vi.fn() },
  subscriptionPlan: { findUnique: vi.fn() },
}))
vi.mock('@/server/db', () => ({ prisma: prismaMock }))

const sessao = vi.hoisted(() => ({ user: {} as Record<string, unknown> }))
vi.mock('@/server/auth/session', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/server/auth/session')>()),
  requireUser: vi.fn(async () => sessao.user),
}))

import { garantirVagaNaEquipe, listarEquipe, removerDaEquipe } from '@/server/services/clinica-equipe'
import { GET as listarRoute } from '@/app/api/veterinarios/route'
import { DELETE as removerRoute } from '@/app/api/veterinarios/[id]/route'

const req = (method: string) => new NextRequest('http://localhost/api/veterinarios', { method })

beforeEach(() => {
  vi.clearAllMocks()
  sessao.user = { id: 'u-cli', userType: 'clinica', clinica: { id: 'cli-1' } }
  prismaMock.veterinarioClinica.findMany.mockResolvedValue([
    { veterinario: { id: 'vet-1', crmv: '123', user: { id: 'u-vet', nome: 'Ana', email: 'a@x.com' } } },
  ])
  prismaMock.veterinarioClinica.deleteMany.mockResolvedValue({ count: 1 })
})

describe('equipe da clínica', () => {
  it('lista só os vínculos aceitos da clínica', async () => {
    const equipe = await listarEquipe('cli-1')
    expect(prismaMock.veterinarioClinica.findMany.mock.calls[0][0].where).toEqual({ clinicaId: 'cli-1', status: 'aceito' })
    expect(equipe.map((v) => v.id)).toEqual(['vet-1'])
  })

  it('GET /veterinarios devolve a equipe', async () => {
    const res = await listarRoute(req('GET'), { params: Promise.resolve({}) })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.veterinarios).toHaveLength(1)
    expect(body.veterinarios[0].id).toBe('vet-1')
  })

  it('remover desfaz só o vínculo, sem apagar o veterinário', async () => {
    await removerDaEquipe('cli-1', 'vet-1')
    expect(prismaMock.veterinarioClinica.deleteMany).toHaveBeenCalledWith({ where: { clinicaId: 'cli-1', veterinarioId: 'vet-1' } })
    expect(prismaMock.veterinario.delete).not.toHaveBeenCalled()
  })

  it('DELETE /veterinarios/:id responde 200 e usa o id da rota', async () => {
    const res = await removerRoute(req('DELETE'), { params: Promise.resolve({ id: 'vet-1' }) })
    expect(res.status).toBe(200)
    expect(prismaMock.veterinarioClinica.deleteMany.mock.calls[0][0].where.veterinarioId).toBe('vet-1')
  })

  it('DELETE sem vínculo responde 404', async () => {
    prismaMock.veterinarioClinica.deleteMany.mockResolvedValue({ count: 0 })
    const res = await removerRoute(req('DELETE'), { params: Promise.resolve({ id: 'vet-x' }) })
    expect(res.status).toBe(404)
  })
})

describe('limite de vets pelo plano da clínica', () => {
  const comPlano = (code: string | null, max: number | null, vinculados: number) => {
    prismaMock.clinica.findUnique.mockResolvedValue({ subscriptionPlanCode: code })
    prismaMock.subscriptionPlan.findUnique.mockResolvedValue(code ? { code, maxVeterinarios: max } : null)
    prismaMock.veterinarioClinica.count.mockResolvedValue(vinculados)
  }

  it('clínica sem plano pago não vincula', async () => {
    comPlano('none', null, 0)
    await expect(garantirVagaNaEquipe('cli-1')).rejects.toMatchObject({ status: 403 })
    expect(prismaMock.subscriptionPlan.findUnique).not.toHaveBeenCalled()
  })

  it('Pequena barra o 6o vet (aceitos + pendentes)', async () => {
    comPlano('starter', 5, 5)
    await expect(garantirVagaNaEquipe('cli-1')).rejects.toMatchObject({ status: 403 })
    comPlano('starter', 5, 4)
    await expect(garantirVagaNaEquipe('cli-1')).resolves.toBeUndefined()
    expect(prismaMock.veterinarioClinica.count.mock.calls.at(-1)![0].where).toEqual({
      clinicaId: 'cli-1',
      status: { in: ['aceito', 'pendente'] },
    })
  })

  it('no aceite, o convite do próprio vet não conta', async () => {
    comPlano('clinic', 15, 14)
    await garantirVagaNaEquipe('cli-1', 'vet-9')
    expect(prismaMock.veterinarioClinica.count.mock.calls[0][0].where.veterinarioId).toEqual({ not: 'vet-9' })
  })

  it('Grande é ilimitado', async () => {
    comPlano('clinic_pro', null, 300)
    await expect(garantirVagaNaEquipe('cli-1')).resolves.toBeUndefined()
  })
})
