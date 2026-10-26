import { beforeEach, describe, expect, it, vi } from 'vitest'

const prismaMock = vi.hoisted(() => {
  const agendamento = { findFirst: vi.fn(), findFirstOrThrow: vi.fn(), updateMany: vi.fn() }
  const m = { agendamento }
  return Object.assign(m, { $transaction: vi.fn((fn: (tx: typeof m) => unknown) => fn(m)) })
})
vi.mock('@/server/db', () => ({ prisma: prismaMock }))

import { HttpError } from '@/server/http'
import { aceitarConsultaDomicilio } from '@/server/services/consulta-domicilio'

const consulta = (over: Record<string, unknown> = {}) => ({
  id: 'ag-1',
  veterinarioId: 'vet-1',
  tipoConsulta: 'domicilio',
  status: 'pendente',
  localEndereco: 'Rua A, 10',
  dataConsulta: '2026-10-30',
  horarioConsulta: '15:00',
  tutor: { userId: 'u-tutor', user: { nome: 'Ana', sobrenome: 'Lima' } },
  veterinario: { user: { nome: 'Bruno', sobrenome: 'Souza' } },
  ...over,
})

beforeEach(() => {
  vi.clearAllMocks()
  prismaMock.$transaction.mockImplementation((fn: (tx: typeof prismaMock) => unknown) => fn(prismaMock))
})

describe('aceitarConsultaDomicilio', () => {
  it('consulta pendente em domicílio passa a confirmada', async () => {
    prismaMock.agendamento.findFirst.mockResolvedValueOnce(consulta())
    prismaMock.agendamento.updateMany.mockResolvedValueOnce({ count: 1 })
    prismaMock.agendamento.findFirstOrThrow.mockResolvedValueOnce(consulta({ status: 'confirmado' }))

    const resultado = await aceitarConsultaDomicilio('vet-1', 'ag-1')

    expect(resultado.novo).toBe(true)
    expect(resultado.agendamento.status).toBe('confirmado')
    expect(prismaMock.agendamento.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'ag-1', veterinarioId: 'vet-1', status: { in: ['pendente', 'agendado', 'marcado'] } },
      data: expect.objectContaining({ status: 'confirmado' }),
    }))
  })

  it('aceite repetido devolve o endereço sem gravar de novo', async () => {
    prismaMock.agendamento.findFirst.mockResolvedValueOnce(consulta({ status: 'confirmado' }))
    const resultado = await aceitarConsultaDomicilio('vet-1', 'ag-1')
    expect(resultado.novo).toBe(false)
    expect(resultado.agendamento.localEndereco).toBe('Rua A, 10')
    expect(prismaMock.agendamento.updateMany).not.toHaveBeenCalled()
  })

  it('recusa consulta que não é domicílio, cancelada ou de outro veterinário', async () => {
    prismaMock.agendamento.findFirst.mockResolvedValueOnce(null)
    await expect(aceitarConsultaDomicilio('vet-1', 'ag-1')).rejects.toMatchObject({ status: 404 })

    prismaMock.agendamento.findFirst.mockResolvedValueOnce(consulta({ tipoConsulta: 'presencial' }))
    await expect(aceitarConsultaDomicilio('vet-1', 'ag-1')).rejects.toMatchObject({ status: 400 })

    prismaMock.agendamento.findFirst.mockResolvedValueOnce(consulta({ status: 'cancelado' }))
    await expect(aceitarConsultaDomicilio('vet-1', 'ag-1')).rejects.toBeInstanceOf(HttpError)
  })
})
