import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { CurrentUser } from '@/server/auth/session'

const prismaMock = vi.hoisted(() => ({
  pet: { findUnique: vi.fn() },
  agendamento: { findFirst: vi.fn(), findMany: vi.fn(), count: vi.fn() },
  registroClinico: { upsert: vi.fn(), findUnique: vi.fn() },
  agendamentoAnotacao: { findMany: vi.fn(), findUnique: vi.fn() },
  encaminhamento: { count: vi.fn() },
}))
vi.mock('@/server/db', () => ({ prisma: prismaMock }))

import {
  MAX_TEXTO_REGISTRO,
  assertAcessoProntuario,
  prontuarioDoPet,
  salvarRegistro,
  validarRegistro,
} from '@/server/services/prontuario'

const PET = { id: 'pet-1', tutorId: 'tutor-a', nome: 'Rex' }
const user = (u: Partial<CurrentUser>) =>
  ({ tutor: null, veterinario: null, clinica: null, ...u }) as CurrentUser

beforeEach(() => {
  vi.clearAllMocks()
  prismaMock.pet.findUnique.mockResolvedValue(PET)
})

describe('assertAcessoProntuario', () => {
  it('libera o tutor dono e bloqueia outro tutor com 404', async () => {
    await expect(
      assertAcessoProntuario(user({ userType: 'tutor', tutor: { id: 'tutor-a' } as never }), 'pet-1')
    ).resolves.toBe(PET)
    await expect(
      assertAcessoProntuario(user({ userType: 'tutor', tutor: { id: 'tutor-b' } as never }), 'pet-1')
    ).rejects.toMatchObject({ status: 404 })
  })

  it('libera vet com consulta não cancelada do pet', async () => {
    prismaMock.agendamento.count.mockResolvedValue(1)
    await assertAcessoProntuario(user({ userType: 'veterinario', veterinario: { id: 'vet-1' } as never }), 'pet-1')
    expect(prismaMock.agendamento.count).toHaveBeenCalledWith({
      where: { petId: 'pet-1', status: { notIn: ['cancelado', 'cancelada'] }, veterinarioId: 'vet-1' },
    })
  })

  it('libera clínica com consulta do pet (filtra por clinicaId)', async () => {
    prismaMock.agendamento.count.mockResolvedValue(2)
    await assertAcessoProntuario(user({ userType: 'clinica', clinica: { id: 'cli-1' } as never }), 'pet-1')
    expect(prismaMock.agendamento.count.mock.calls[0][0].where.clinicaId).toBe('cli-1')
  })

  it('vet ou clínica sem consulta com o pet recebe 404', async () => {
    prismaMock.agendamento.count.mockResolvedValue(0)
    await expect(
      assertAcessoProntuario(user({ userType: 'veterinario', veterinario: { id: 'vet-3' } as never }), 'pet-1')
    ).rejects.toMatchObject({ status: 404 })
  })

  it('pet inexistente retorna 404', async () => {
    prismaMock.pet.findUnique.mockResolvedValue(null)
    await expect(
      assertAcessoProntuario(user({ userType: 'tutor', tutor: { id: 'tutor-a' } as never }), 'x')
    ).rejects.toMatchObject({ status: 404 })
  })
})

describe('prontuarioDoPet', () => {
  it('exclui canceladas e nunca consulta a anotação privada', async () => {
    prismaMock.agendamento.findMany.mockResolvedValue([])
    await prontuarioDoPet('pet-1')

    const args = prismaMock.agendamento.findMany.mock.calls[0][0]
    expect(args.where).toEqual({ petId: 'pet-1', status: { notIn: ['cancelado', 'cancelada'] } })
    expect(args.select).not.toHaveProperty('anotacao')
    expect(args.include).toBeUndefined()
    expect(prismaMock.agendamentoAnotacao.findMany).not.toHaveBeenCalled()
    expect(prismaMock.agendamentoAnotacao.findUnique).not.toHaveBeenCalled()
  })

  it('serializa a linha do tempo com o registro clínico', async () => {
    prismaMock.agendamento.findMany.mockResolvedValue([
      {
        id: 'ag-1',
        dataConsulta: '2026-10-01',
        horarioConsulta: '10:00',
        tipoConsulta: 'presencial',
        status: 'realizado',
        localNome: 'Clínica X',
        veterinario: { user: { nome: 'Ana', sobrenome: 'Lima' } },
        clinica: { nomeClinica: 'Clínica X' },
        registroClinico: { id: 'r1', agendamentoId: 'ag-1', pesoKg: '12.50', diagnostico: 'Otite' },
      },
    ])
    const [item] = await prontuarioDoPet('pet-1')
    expect(item).toMatchObject({
      agendamento_id: 'ag-1',
      veterinario_nome: 'Ana Lima',
      clinica_nome: 'Clínica X',
      registro: { peso_kg: 12.5, diagnostico: 'Otite' },
    })
  })
})

describe('salvarRegistro', () => {
  it('bloqueia antes do início do atendimento', async () => {
    prismaMock.agendamento.findFirst.mockResolvedValue({ id: 'ag-1', petId: 'pet-1', status: 'confirmado', startedAt: null })
    await expect(salvarRegistro('ag-1', 'vet-1', {})).rejects.toMatchObject({ status: 400 })
    expect(prismaMock.registroClinico.upsert).not.toHaveBeenCalled()
  })

  it('consulta de outro vet retorna 404', async () => {
    prismaMock.agendamento.findFirst.mockResolvedValue(null)
    await expect(salvarRegistro('ag-1', 'vet-2', {})).rejects.toMatchObject({ status: 404 })
  })

  it('faz upsert vinculando pet e vet da consulta', async () => {
    prismaMock.agendamento.findFirst.mockResolvedValue({ id: 'ag-1', petId: 'pet-1', status: 'realizado', startedAt: null })
    prismaMock.registroClinico.upsert.mockResolvedValue({})
    await salvarRegistro('ag-1', 'vet-1', { diagnostico: 'Otite', peso_kg: 12.5 })
    const args = prismaMock.registroClinico.upsert.mock.calls[0][0]
    expect(args.where).toEqual({ agendamentoId: 'ag-1' })
    expect(args.create).toMatchObject({ agendamentoId: 'ag-1', petId: 'pet-1', veterinarioId: 'vet-1', diagnostico: 'Otite', pesoKg: 12.5 })
  })
})

describe('validarRegistro', () => {
  const hoje = '2026-10-09'

  it('normaliza vazios para null', async () => {
    await expect(validarRegistro({}, hoje)).resolves.toEqual({
      queixa: null,
      diagnostico: null,
      tratamento: null,
      pesoKg: null,
      vacinasMedicacoes: null,
      retornoSugerido: null,
      planoSaude: null,
      encaminhamento: null,
    })
  })

  it('valida peso entre 0 e 500 kg', async () => {
    await expect(validarRegistro({ peso_kg: -1 }, hoje)).rejects.toBeDefined()
    await expect(validarRegistro({ peso_kg: 501 }, hoje)).rejects.toBeDefined()
    await expect(validarRegistro({ peso_kg: 12.5 }, hoje)).resolves.toMatchObject({ pesoKg: 12.5 })
  })

  it('retorno não pode ser no passado nem em formato inválido', async () => {
    await expect(validarRegistro({ retorno_sugerido: '2026-10-08' }, hoje)).rejects.toMatchObject({ status: 422 })
    await expect(validarRegistro({ retorno_sugerido: '09/10/2026' }, hoje)).rejects.toBeDefined()
    await expect(validarRegistro({ retorno_sugerido: '2026-10-09' }, hoje)).resolves.toMatchObject({
      retornoSugerido: '2026-10-09',
    })
  })

  it('recusa textos acima do limite', async () => {
    await expect(validarRegistro({ tratamento: 'x'.repeat(MAX_TEXTO_REGISTRO + 1) }, hoje)).rejects.toBeDefined()
  })
})
