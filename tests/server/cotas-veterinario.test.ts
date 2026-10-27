import { beforeEach, describe, expect, it, vi } from 'vitest'
vi.mock('@/server/db', () => ({ prisma: {} }))
import { consumirCotaVeterinario, liberarCotasVeterinario, usoMensalVeterinario } from '@/server/services/cotas-veterinario'

const banco = () => ({
  $executeRaw: vi.fn(),
  veterinario: { findUniqueOrThrow: vi.fn().mockResolvedValue({ subscriptionPlanCode: 'free' }), update: vi.fn() },
  subscriptionPlan: { findUnique: vi.fn().mockResolvedValue({ monthlyAppointmentLimit: 5 }) },
  agendamento: { count: vi.fn().mockResolvedValue(0), update: vi.fn(), updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
})
let db = banco()
beforeEach(() => { db = banco() })

describe('freemium veterinário', () => {
  it('quarta reserva já usada permite a quinta; registra consumo na reserva', async () => {
    db.agendamento.count.mockResolvedValue(4)
    await consumirCotaVeterinario(db as never, 'v', 'a5')
    expect(db.$executeRaw).toHaveBeenCalledOnce()
    expect(db.$executeRaw.mock.invocationCallOrder[0]).toBeLessThan(db.agendamento.count.mock.invocationCallOrder[0])
    expect(db.agendamento.update).toHaveBeenCalledWith({ where: { id: 'a5' }, data: { cotaConsumidaEm: expect.any(Date), cotaLiberadaEm: null } })
    expect(db.veterinario.update).toHaveBeenCalledWith({ where: { id: 'v' }, data: expect.objectContaining({ monthlyAppointmentsUsed: 5 }) })
  })
  it('sexta reserva é recusada sem gravar consumo', async () => {
    db.agendamento.count.mockResolvedValue(5)
    await expect(consumirCotaVeterinario(db as never, 'v', 'a6')).rejects.toMatchObject({ status: 403 })
    expect(db.agendamento.update).not.toHaveBeenCalled()
    expect(db.veterinario.update).not.toHaveBeenCalled()
  })
  it.each(['vet_pro', 'vet_starter', 'pro'])('plano pago/cortesia %s mantém acesso ilimitado', async codigo => {
    db.veterinario.findUniqueOrThrow.mockResolvedValue({ subscriptionPlanCode: codigo })
    db.subscriptionPlan.findUnique.mockResolvedValue({ monthlyAppointmentLimit: null } as never)
    db.agendamento.count.mockResolvedValue(50)
    await consumirCotaVeterinario(db as never, 'v', 'a')
    expect(db.agendamento.update).toHaveBeenCalledOnce()
  })
  it('plano inexistente não concede acesso', async () => {
    db.subscriptionPlan.findUnique.mockResolvedValue(null as never)
    await expect(consumirCotaVeterinario(db as never, 'v', 'a')).rejects.toMatchObject({ status: 403 })
  })
  it('cancelar reserva antiga não reduz artificialmente o consumo do mês atual', async () => {
    db.agendamento.updateMany.mockResolvedValue({ count: 0 })
    db.agendamento.count.mockResolvedValue(5)
    await liberarCotasVeterinario(db as never, 'v', ['outro-mes'])
    expect(db.veterinario.update).toHaveBeenCalledWith({ where: { id: 'v' }, data: expect.objectContaining({ monthlyAppointmentsUsed: 5 }) })
    expect(db.agendamento.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ veterinarioId: 'v', startedAt: null, cotaLiberadaEm: null }) }))
  })
  it('cancelamento repetido não devolve duas unidades; recalcula registros válidos', async () => {
    db.agendamento.count.mockResolvedValue(4)
    await liberarCotasVeterinario(db as never, 'v', ['a'])
    db.agendamento.updateMany.mockResolvedValue({ count: 0 })
    await liberarCotasVeterinario(db as never, 'v', ['a'])
    expect(db.veterinario.update.mock.calls.map(([args]) => args.data.monthlyAppointmentsUsed)).toEqual([4, 4])
  })
  it('mês, profissional e perfil isolam a cota; não filtra por local ou data da consulta', async () => {
    await usoMensalVeterinario(db as never, 'v', new Date('2026-11-01T02:59:59Z'))
    expect(db.agendamento.count).toHaveBeenCalledWith({ where: {
      veterinarioId: 'v', cotaLiberadaEm: null,
      cotaConsumidaEm: { gte: new Date('2026-10-01T03:00:00Z'), lt: new Date('2026-11-01T03:00:00Z') },
    } })
  })
})
