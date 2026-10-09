import { describe, it, expect, vi, beforeEach } from 'vitest'

const prismaMock = vi.hoisted(() => ({
  agendamento: { findFirst: vi.fn() },
  agendamentoAnotacao: { findUnique: vi.fn(), findMany: vi.fn(), upsert: vi.fn() },
}))
vi.mock('@/server/db', () => ({ prisma: prismaMock }))

import {
  MENSAGEM_ANOTACAO_INDISPONIVEL,
  historicoDoPet,
  obterAnotacao,
  podeAnotar,
  salvarAnotacao,
  serializeAnotacao,
  validarAnotacao,
} from '@/server/services/anotacoes'

const EM_ANDAMENTO = { id: 'ag-1', veterinarioId: 'vet-1', petId: 'pet-1', status: 'confirmado', startedAt: new Date() }

const anotacao = (over: Record<string, unknown> = {}) => ({
  id: 'an-1',
  agendamentoId: 'ag-1',
  veterinarioId: 'vet-1',
  localAtendimento: 'Online',
  statusPagamento: 'pago',
  formaPagamento: 'pix',
  planoNome: null,
  observacoes: 'Tosse seca',
  createdAt: new Date('2026-10-01T10:00:00Z'),
  updatedAt: new Date('2026-10-01T10:00:00Z'),
  ...over,
})

beforeEach(() => {
  vi.clearAllMocks()
})

describe('podeAnotar (janela da anotação)', () => {
  it('libera a partir do início do atendimento e depois de concluída', () => {
    expect(podeAnotar({ status: 'confirmado', startedAt: new Date() })).toBe(true)
    expect(podeAnotar({ status: 'realizado', startedAt: null })).toBe(true)
  })

  it('bloqueia pendente/confirmada sem início e qualquer cancelada (mesmo iniciada)', () => {
    expect(podeAnotar({ status: 'pendente', startedAt: null })).toBe(false)
    expect(podeAnotar({ status: 'confirmado', startedAt: null })).toBe(false)
    expect(podeAnotar({ status: 'cancelada', startedAt: new Date() })).toBe(false)
  })
})

describe('validarAnotacao', () => {
  it('só guarda o nome do plano quando a forma é plano_pet', async () => {
    await expect(
      validarAnotacao({ forma_pagamento: 'pix', plano_nome: 'Plano Ouro', status_pagamento: 'pago' })
    ).resolves.toEqual({
      localAtendimento: null,
      statusPagamento: 'pago',
      formaPagamento: 'pix',
      planoNome: null,
      observacoes: null,
    })
    const comPlano = await validarAnotacao({ forma_pagamento: 'plano_pet', plano_nome: ' Plano Ouro ' })
    expect(comPlano.planoNome).toBe('Plano Ouro')
    const planoVazio = await validarAnotacao({ forma_pagamento: 'plano_pet', plano_nome: '' })
    expect(planoVazio.planoNome).toBeNull()
  })

  it('recusa status ou forma de pagamento fora da lista', async () => {
    await expect(validarAnotacao({ status_pagamento: 'estornado' })).rejects.toThrow()
    await expect(validarAnotacao({ forma_pagamento: 'boleto' })).rejects.toThrow()
  })
})

describe('serializeAnotacao', () => {
  it('converte para snake_case e mantém null', () => {
    expect(serializeAnotacao(null)).toBeNull()
    expect(serializeAnotacao(anotacao() as never)).toEqual({
      id: 'an-1',
      agendamento_id: 'ag-1',
      local_atendimento: 'Online',
      status_pagamento: 'pago',
      forma_pagamento: 'pix',
      plano_nome: null,
      observacoes: 'Tosse seca',
      updated_at: new Date('2026-10-01T10:00:00Z'),
    })
  })
})

describe('obterAnotacao', () => {
  it('só o vet dono lê: busca a consulta filtrando pelo veterinário', async () => {
    prismaMock.agendamento.findFirst.mockResolvedValueOnce(EM_ANDAMENTO)
    prismaMock.agendamentoAnotacao.findUnique.mockResolvedValueOnce(anotacao())
    await expect(obterAnotacao('ag-1', 'vet-1')).resolves.toMatchObject({ id: 'an-1' })
    expect(prismaMock.agendamento.findFirst).toHaveBeenCalledWith({ where: { id: 'ag-1', veterinarioId: 'vet-1' } })
    expect(prismaMock.agendamentoAnotacao.findUnique).toHaveBeenCalledWith({ where: { agendamentoId: 'ag-1' } })
  })

  it('outro veterinário recebe 404 e a anotação nem é consultada', async () => {
    prismaMock.agendamento.findFirst.mockResolvedValueOnce(null)
    await expect(obterAnotacao('ag-1', 'vet-2')).rejects.toMatchObject({ status: 404 })
    expect(prismaMock.agendamentoAnotacao.findUnique).not.toHaveBeenCalled()
  })
})

describe('historicoDoPet', () => {
  it('consulta sem pet devolve lista vazia sem buscar anotações', async () => {
    prismaMock.agendamento.findFirst.mockResolvedValueOnce({ ...EM_ANDAMENTO, petId: null })
    await expect(historicoDoPet('ag-1', 'vet-1')).resolves.toEqual([])
    expect(prismaMock.agendamentoAnotacao.findMany).not.toHaveBeenCalled()
  })

  it('traz só anotações do próprio vet em outras consultas do mesmo pet, mais recentes primeiro', async () => {
    prismaMock.agendamento.findFirst.mockResolvedValueOnce(EM_ANDAMENTO)
    prismaMock.agendamentoAnotacao.findMany.mockResolvedValueOnce([
      anotacao({
        id: 'an-0',
        agendamentoId: 'ag-0',
        agendamento: { dataConsulta: '2026-09-01', horarioConsulta: '10:00', status: 'realizado', tipoConsulta: 'online' },
      }),
    ])
    const lista = await historicoDoPet('ag-1', 'vet-1')
    const args = prismaMock.agendamentoAnotacao.findMany.mock.calls[0][0]
    expect(args.where).toEqual({
      veterinarioId: 'vet-1',
      agendamentoId: { not: 'ag-1' },
      agendamento: { petId: 'pet-1', veterinarioId: 'vet-1' },
    })
    expect(args.orderBy).toEqual([{ agendamento: { dataConsulta: 'desc' } }, { createdAt: 'desc' }])
    expect(lista).toEqual([
      expect.objectContaining({
        id: 'an-0',
        agendamento_id: 'ag-0',
        data_consulta: '2026-09-01',
        horario_consulta: '10:00',
        status_consulta: 'realizado',
        tipo_consulta: 'online',
      }),
    ])
    expect(lista[0]).not.toHaveProperty('agendamento')
  })

  it('outro vet recebe 404', async () => {
    prismaMock.agendamento.findFirst.mockResolvedValueOnce(null)
    await expect(historicoDoPet('ag-1', 'vet-2')).rejects.toMatchObject({ status: 404 })
  })
})

describe('salvarAnotacao', () => {
  it('cria ou atualiza (upsert) a anotação 1:1 da consulta com o vet como autor', async () => {
    prismaMock.agendamento.findFirst.mockResolvedValueOnce(EM_ANDAMENTO)
    prismaMock.agendamentoAnotacao.upsert.mockResolvedValueOnce(anotacao())
    await salvarAnotacao('ag-1', 'vet-1', { observacoes: '  Tosse seca ', status_pagamento: 'isento' })
    const args = prismaMock.agendamentoAnotacao.upsert.mock.calls[0][0]
    expect(args.where).toEqual({ agendamentoId: 'ag-1' })
    expect(args.create).toMatchObject({
      agendamentoId: 'ag-1',
      veterinarioId: 'vet-1',
      observacoes: 'Tosse seca',
      statusPagamento: 'isento',
    })
    expect(args.create.id).toEqual(expect.any(String))
    expect(args.create.createdAt).toBeInstanceOf(Date)
    expect(args.update).toMatchObject({ observacoes: 'Tosse seca', statusPagamento: 'isento' })
    expect(args.update.updatedAt).toBeInstanceOf(Date)
    expect(args.update).not.toHaveProperty('veterinarioId')
  })

  it('consulta pendente, confirmada sem início ou cancelada: 400 sem gravar', async () => {
    for (const ag of [
      { ...EM_ANDAMENTO, status: 'pendente', startedAt: null },
      { ...EM_ANDAMENTO, startedAt: null },
      { ...EM_ANDAMENTO, status: 'cancelado' },
    ]) {
      prismaMock.agendamento.findFirst.mockResolvedValueOnce(ag)
      await expect(salvarAnotacao('ag-1', 'vet-1', {})).rejects.toMatchObject({
        status: 400,
        message: MENSAGEM_ANOTACAO_INDISPONIVEL,
      })
    }
    expect(prismaMock.agendamentoAnotacao.upsert).not.toHaveBeenCalled()
  })

  it('outro vet: 404', async () => {
    prismaMock.agendamento.findFirst.mockResolvedValueOnce(null)
    await expect(salvarAnotacao('ag-1', 'vet-2', {})).rejects.toMatchObject({ status: 404 })
  })
})
