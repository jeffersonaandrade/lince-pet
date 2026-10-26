import { beforeEach, describe, expect, it, vi } from 'vitest'

const db = vi.hoisted(() => ({
  veterinario: { count: vi.fn() },
  clinica: { count: vi.fn() },
  recuperacaoCnpj: { count: vi.fn() },
  user: { groupBy: vi.fn() },
  agendamento: { groupBy: vi.fn() },
  subscription: { groupBy: vi.fn() },
  subscriptionPlan: { findMany: vi.fn() },
}))
vi.mock('@/server/db', () => ({ prisma: db }))

import { consultarPainel, periodoDoMes } from '@/server/services/admin-dashboard'

beforeEach(() => {
  vi.clearAllMocks()
  db.veterinario.count.mockResolvedValue(3)
  db.clinica.count.mockResolvedValue(1)
  db.recuperacaoCnpj.count.mockResolvedValue(2)
  db.user.groupBy.mockResolvedValue([
    { userType: 'tutor', _count: { _all: 10 } },
    { userType: 'veterinario', _count: { _all: 4 } },
  ])
  db.agendamento.groupBy.mockImplementation(async ({ where }: { where: { veterinarioId?: unknown } }) =>
    where.veterinarioId
      ? [{ status: 'confirmado', _count: { _all: 2 } }]
      : [{ status: 'pendente', _count: { _all: 1 } }]
  )
  db.subscription.groupBy.mockResolvedValue([
    { planId: 'p1', _count: { _all: 5 } },
    { planId: 'sumiu', _count: { _all: 1 } },
  ])
  db.subscriptionPlan.findMany.mockResolvedValue([{ id: 'p1', code: 'vet_starter' }])
})

describe('periodoDoMes', () => {
  it('usa o mês civil de Brasília e vira o ano em dezembro', () => {
    expect(periodoDoMes(new Date('2026-11-01T02:30:00Z'))).toEqual({ mes: '2026-10', inicio: '2026-10-01', fim: '2026-11-01' })
    expect(periodoDoMes(new Date('2026-11-01T03:00:00Z'))).toEqual({ mes: '2026-11', inicio: '2026-11-01', fim: '2026-12-01' })
    expect(periodoDoMes(new Date('2026-12-15T15:00:00Z')).fim).toBe('2027-01-01')
  })
})

describe('consultarPainel', () => {
  it('devolve só contagens, zera o que não veio e separa consulta de pedido', async () => {
    const painel = await consultarPainel(new Date('2026-10-26T15:00:00Z'))
    expect(painel.mes).toBe('2026-10')
    expect(painel.filas).toEqual({ crmv: 3, responsavelTecnico: 1, recuperacoesCnpj: 2 })
    expect(painel.contas).toEqual({ tutor: 10, veterinario: 4, clinica: 0, prestador: 0 })
    expect(painel.agenda.consultas).toEqual({ pendente: 0, confirmado: 2, emAndamento: 0, realizado: 0, cancelado: 0 })
    expect(painel.agenda.pedidos.pendente).toBe(1)
    expect(painel.assinaturas).toEqual({
      total: 6,
      porPlano: [
        { codigo: 'sem plano', quantidade: 1 },
        { codigo: 'vet_starter', quantidade: 5 },
      ],
    })
    expect(db.veterinario.count).toHaveBeenCalledWith({ where: { crmvStatus: 'pendente', crmv: { not: null } } })
    expect(db.user.groupBy).toHaveBeenCalledWith({ by: ['userType'], where: { ativo: 1 }, _count: { _all: true } })
    expect(db.agendamento.groupBy).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        dataConsulta: { gte: '2026-10-01', lt: '2026-11-01' },
        veterinarioId: { not: null },
      }),
    }))
    expect(db.subscription.groupBy).toHaveBeenCalledWith({ by: ['planId'], where: { status: 'active' }, _count: { _all: true } })
  })
})
