import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/server/db', () => ({ prisma: {} }))
import { conferirPendentes, consumirCota, liberarCota, mesDaCota } from '@/server/services/cotas-prestador'

const banco = () => ({
  $executeRaw: vi.fn(),
  prestador: { findUniqueOrThrow: vi.fn().mockResolvedValue({ subscriptionPlanCode: 'free' }), update: vi.fn() },
  subscriptionPlan: { findUnique: vi.fn().mockResolvedValue({ monthlyAppointmentLimit: 5 }) },
  agendamento: { count: vi.fn().mockResolvedValue(0), update: vi.fn(), updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
})
let db = banco()
beforeEach(() => { db = banco() })

describe('mês da cota usa Brasília independentemente do fuso do servidor', () => {
  it('02:59 UTC ainda pertence ao mês anterior', () => {
    const mes = mesDaCota(new Date('2026-11-01T02:59:59.999Z'))
    expect(mes.gte.toISOString()).toBe('2026-10-01T03:00:00.000Z')
    expect(mes.lt.toISOString()).toBe('2026-11-01T03:00:00.000Z')
  })
  it('03:00 UTC já pertence ao novo mês', () => {
    expect(mesDaCota(new Date('2026-11-01T03:00:00Z')).gte.toISOString()).toBe('2026-11-01T03:00:00.000Z')
  })
})
it('plano cheio rejeita antes de gravar consumo ou contador', async () => {
  db.agendamento.count.mockResolvedValue(5)
  await expect(consumirCota(db as never, 'p', 'a')).rejects.toMatchObject({ status: 403 })
  expect(db.agendamento.update).not.toHaveBeenCalled()
  expect(db.prestador.update).not.toHaveBeenCalled()
})
it('ilimitado permite mais de dez aceites e mantém contagem real', async () => {
  db.prestador.findUniqueOrThrow.mockResolvedValue({ subscriptionPlanCode: 'pro' })
  db.subscriptionPlan.findUnique.mockResolvedValue({ monthlyAppointmentLimit: null } as never)
  db.agendamento.count.mockResolvedValue(99)
  await consumirCota(db as never, 'p', 'a')
  expect(db.prestador.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ monthlyAppointmentsUsed: 100 }) }))
})
it('liberação repetida/antiga recalcula pelos registros em vez de subtrair um contador arbitrário', async () => {
  db.agendamento.updateMany.mockResolvedValue({ count: 0 })
  db.agendamento.count.mockResolvedValue(3)
  await liberarCota(db as never, 'p', 'a')
  expect(db.prestador.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ monthlyAppointmentsUsed: 3 }) }))
  expect(db.agendamento.count).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ cotaLiberadaEm: null }) }))
})
it('quarto pendente é recusado mesmo sem consumir plano', async () => {
  db.agendamento.count.mockResolvedValue(3)
  await expect(conferirPendentes(db as never, 'p', 't')).rejects.toMatchObject({ status: 409 })
})
