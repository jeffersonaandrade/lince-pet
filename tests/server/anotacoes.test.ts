import { describe, it, expect, vi, beforeEach } from 'vitest'

const prismaMock = vi.hoisted(() => ({
  agendamento: { findFirst: vi.fn() },
  agendamentoAnotacao: { findMany: vi.fn() },
}))
vi.mock('@/server/db', () => ({ prisma: prismaMock }))

import { MAX_OBSERVACOES, historicoDoPet, podeAnotar, validarAnotacao } from '@/server/services/anotacoes'

const iniciado = new Date('2026-10-08T12:00:00Z')

describe('podeAnotar', () => {
  it('não libera antes do início do atendimento', () => {
    expect(podeAnotar({ status: 'pendente', startedAt: null })).toBe(false)
    expect(podeAnotar({ status: 'confirmado', startedAt: null })).toBe(false)
  })

  it('libera em andamento (startedAt) e depois de concluída', () => {
    expect(podeAnotar({ status: 'em andamento', startedAt: iniciado })).toBe(true)
    expect(podeAnotar({ status: 'realizado', startedAt: iniciado })).toBe(true)
    expect(podeAnotar({ status: 'realizado', startedAt: null })).toBe(true)
    expect(podeAnotar({ status: 'concluido', startedAt: null })).toBe(true)
  })

  it('nunca libera consulta cancelada', () => {
    expect(podeAnotar({ status: 'cancelado', startedAt: iniciado })).toBe(false)
  })
})

describe('historicoDoPet', () => {
  beforeEach(() => vi.clearAllMocks())

  it('busca só anotações do próprio vet, do mesmo pet, excluindo a consulta atual', async () => {
    prismaMock.agendamento.findFirst.mockResolvedValue({ id: 'ag-atual', petId: 'pet-1', veterinarioId: 'vet-a' })
    prismaMock.agendamentoAnotacao.findMany.mockResolvedValue([])

    await historicoDoPet('ag-atual', 'vet-a')

    expect(prismaMock.agendamento.findFirst).toHaveBeenCalledWith({ where: { id: 'ag-atual', veterinarioId: 'vet-a' } })
    expect(prismaMock.agendamentoAnotacao.findMany.mock.calls[0][0].where).toEqual({
      veterinarioId: 'vet-a',
      agendamentoId: { not: 'ag-atual' },
      agendamento: { petId: 'pet-1', veterinarioId: 'vet-a' },
    })
  })

  it('consulta de outro vet retorna 404', async () => {
    prismaMock.agendamento.findFirst.mockResolvedValue(null)
    await expect(historicoDoPet('ag-x', 'vet-b')).rejects.toMatchObject({ status: 404 })
    expect(prismaMock.agendamentoAnotacao.findMany).not.toHaveBeenCalled()
  })
})

describe('validarAnotacao', () => {
  it('normaliza vazios para null', async () => {
    await expect(validarAnotacao({})).resolves.toEqual({
      localAtendimento: null,
      statusPagamento: null,
      formaPagamento: null,
      planoNome: null,
      observacoes: null,
    })
  })

  it('só guarda o nome do plano quando a forma é plano_pet', async () => {
    const comPlano = await validarAnotacao({ forma_pagamento: 'plano_pet', plano_nome: 'Petlove' })
    expect(comPlano.planoNome).toBe('Petlove')
    const pix = await validarAnotacao({ forma_pagamento: 'pix', plano_nome: 'Petlove' })
    expect(pix.planoNome).toBeNull()
  })

  it('recusa enums inválidos e observações acima do limite', async () => {
    await expect(validarAnotacao({ status_pagamento: 'talvez' })).rejects.toBeDefined()
    await expect(validarAnotacao({ forma_pagamento: 'boleto' })).rejects.toBeDefined()
    await expect(validarAnotacao({ observacoes: 'x'.repeat(MAX_OBSERVACOES + 1) })).rejects.toBeDefined()
  })
})
