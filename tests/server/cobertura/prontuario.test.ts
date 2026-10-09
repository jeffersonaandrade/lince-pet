import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { CurrentUser } from '@/server/auth/session'

const prismaMock = vi.hoisted(() => ({
  pet: { findUnique: vi.fn() },
  agendamento: { findFirst: vi.fn(), findMany: vi.fn(), count: vi.fn() },
  registroClinico: { upsert: vi.fn(), findUnique: vi.fn() },
  encaminhamento: { count: vi.fn() },
}))
vi.mock('@/server/db', () => ({ prisma: prismaMock }))

import {
  MAX_TEXTO_REGISTRO,
  PESO_MAXIMO_KG,
  assertAcessoProntuario,
  obterRegistro,
  prontuarioDoPet,
  salvarRegistro,
  serializePetProntuario,
  serializeRegistro,
  validarRegistro,
} from '@/server/services/prontuario'

const PET = { id: 'pet-1', tutorId: 'tutor-a', nome: 'Rex' }
const user = (u: Partial<CurrentUser>) =>
  ({ tutor: null, veterinario: null, clinica: null, prestador: null, ...u }) as CurrentUser
const CONSULTA = { id: 'ag-1', veterinarioId: 'vet-1', petId: 'pet-1', status: 'realizado', startedAt: new Date() }

const registro = (over: Record<string, unknown> = {}) => ({
  id: 'rc-1',
  agendamentoId: 'ag-1',
  petId: 'pet-1',
  veterinarioId: 'vet-1',
  queixa: 'Coceira',
  diagnostico: 'Dermatite',
  tratamento: null,
  pesoKg: '12.50',
  vacinasMedicacoes: null,
  retornoSugerido: '2026-11-01',
  planoSaude: null,
  encaminhamento: null,
  updatedAt: new Date('2026-10-01T10:00:00Z'),
  ...over,
})

beforeEach(() => {
  vi.clearAllMocks()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('validarRegistro', () => {
  it('aceita retorno hoje, converte vazios em null e preserva peso 0', async () => {
    await expect(
      validarRegistro({ queixa: ' ', peso_kg: 0, retorno_sugerido: '2026-10-09' }, '2026-10-09')
    ).resolves.toEqual({
      queixa: null,
      diagnostico: null,
      tratamento: null,
      pesoKg: 0,
      vacinasMedicacoes: null,
      retornoSugerido: '2026-10-09',
      planoSaude: null,
      encaminhamento: null,
    })
  })

  it('usa a data de hoje por padrão para recusar retorno no passado', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2026, 9, 9, 12, 0))
    await expect(validarRegistro({ retorno_sugerido: '2026-10-08' })).rejects.toMatchObject({ status: 422 })
    await expect(validarRegistro({ retorno_sugerido: '2026-10-10' })).resolves.toMatchObject({
      retornoSugerido: '2026-10-10',
    })
  })

  it('recusa data de retorno inexistente com 422', async () => {
    await expect(validarRegistro({ retorno_sugerido: '2026-02-30' }, '2026-01-01')).rejects.toMatchObject({
      status: 422,
    })
  })

  it('recusa peso acima de 500 kg e texto acima de 5000 caracteres', async () => {
    await expect(validarRegistro({ peso_kg: PESO_MAXIMO_KG + 1 })).rejects.toThrow()
    await expect(validarRegistro({ peso_kg: -1 })).rejects.toThrow()
    await expect(validarRegistro({ diagnostico: 'x'.repeat(MAX_TEXTO_REGISTRO + 1) })).rejects.toThrow()
  })
})

describe('serializeRegistro', () => {
  it('converte peso DECIMAL em número e mantém null', () => {
    expect(serializeRegistro(null)).toBeNull()
    expect(serializeRegistro(registro() as never)).toMatchObject({ agendamento_id: 'ag-1', peso_kg: 12.5 })
    expect(serializeRegistro(registro({ pesoKg: null }) as never)!.peso_kg).toBeNull()
  })
})

describe('obterRegistro', () => {
  it('só o vet da consulta lê o registro', async () => {
    prismaMock.agendamento.findFirst.mockResolvedValueOnce(CONSULTA)
    prismaMock.registroClinico.findUnique.mockResolvedValueOnce(registro())
    await expect(obterRegistro('ag-1', 'vet-1')).resolves.toMatchObject({ id: 'rc-1' })
    expect(prismaMock.agendamento.findFirst).toHaveBeenCalledWith({ where: { id: 'ag-1', veterinarioId: 'vet-1' } })
    expect(prismaMock.registroClinico.findUnique).toHaveBeenCalledWith({ where: { agendamentoId: 'ag-1' } })
  })

  it('outro vet recebe 404', async () => {
    prismaMock.agendamento.findFirst.mockResolvedValueOnce(null)
    await expect(obterRegistro('ag-1', 'vet-2')).rejects.toMatchObject({ status: 404 })
    expect(prismaMock.registroClinico.findUnique).not.toHaveBeenCalled()
  })
})

describe('salvarRegistro', () => {
  it('grava o registro 1:1 da consulta com pet e vet', async () => {
    prismaMock.agendamento.findFirst.mockResolvedValueOnce(CONSULTA)
    prismaMock.registroClinico.upsert.mockResolvedValueOnce(registro())
    await salvarRegistro('ag-1', 'vet-1', { diagnostico: 'Otite', peso_kg: 8 })
    const args = prismaMock.registroClinico.upsert.mock.calls[0][0]
    expect(args.where).toEqual({ agendamentoId: 'ag-1' })
    expect(args.create).toMatchObject({ agendamentoId: 'ag-1', petId: 'pet-1', veterinarioId: 'vet-1', diagnostico: 'Otite', pesoKg: 8 })
    expect(args.update).toMatchObject({ diagnostico: 'Otite', pesoKg: 8 })
  })

  it('consulta sem pet vinculado: 400', async () => {
    prismaMock.agendamento.findFirst.mockResolvedValueOnce({ ...CONSULTA, petId: null })
    await expect(salvarRegistro('ag-1', 'vet-1', {})).rejects.toMatchObject({
      status: 400,
      message: 'Consulta sem pet vinculado',
    })
  })

  it('antes do início do atendimento ou cancelada: 400', async () => {
    prismaMock.agendamento.findFirst.mockResolvedValueOnce({ ...CONSULTA, status: 'confirmado', startedAt: null })
    await expect(salvarRegistro('ag-1', 'vet-1', {})).rejects.toMatchObject({ status: 400 })
    prismaMock.agendamento.findFirst.mockResolvedValueOnce({ ...CONSULTA, status: 'cancelado' })
    await expect(salvarRegistro('ag-1', 'vet-1', {})).rejects.toMatchObject({ status: 400 })
    expect(prismaMock.registroClinico.upsert).not.toHaveBeenCalled()
  })

  it('vet que não é da consulta: 404', async () => {
    prismaMock.agendamento.findFirst.mockResolvedValueOnce(null)
    await expect(salvarRegistro('ag-1', 'vet-2', {})).rejects.toMatchObject({ status: 404 })
  })
})

describe('assertAcessoProntuario', () => {
  it('pet inexistente: 404', async () => {
    prismaMock.pet.findUnique.mockResolvedValueOnce(null)
    await expect(assertAcessoProntuario(user({ userType: 'tutor' }), 'pet-x')).rejects.toMatchObject({ status: 404 })
  })

  it('tutor dono vê o prontuário; outro tutor recebe 404', async () => {
    prismaMock.pet.findUnique.mockResolvedValueOnce(PET)
    await expect(
      assertAcessoProntuario(user({ userType: 'tutor', tutor: { id: 'tutor-a' } as never }), 'pet-1')
    ).resolves.toBe(PET)
    prismaMock.pet.findUnique.mockResolvedValueOnce(PET)
    await expect(
      assertAcessoProntuario(user({ userType: 'tutor', tutor: { id: 'tutor-b' } as never }), 'pet-1')
    ).rejects.toMatchObject({ status: 404 })
  })

  it('tutor sem perfil de tutor: 404', async () => {
    prismaMock.pet.findUnique.mockResolvedValueOnce(PET)
    await expect(assertAcessoProntuario(user({ userType: 'tutor' }), 'pet-1')).rejects.toMatchObject({ status: 404 })
  })

  it('prestador sem consulta só entra por encaminhamento enviado/aceito', async () => {
    const prestador = user({ userType: 'prestador', prestador: { id: 'pr-1' } as never })
    prismaMock.pet.findUnique.mockResolvedValueOnce(PET)
    prismaMock.encaminhamento.count.mockResolvedValueOnce(1)
    await expect(assertAcessoProntuario(prestador, 'pet-1')).resolves.toBe(PET)
    expect(prismaMock.agendamento.count).not.toHaveBeenCalled()
    expect(prismaMock.encaminhamento.count).toHaveBeenCalledWith({
      where: { petId: 'pet-1', status: { in: ['enviado', 'aceito'] }, destinoPrestadorId: 'pr-1' },
    })

    prismaMock.pet.findUnique.mockResolvedValueOnce(PET)
    prismaMock.encaminhamento.count.mockResolvedValueOnce(0)
    await expect(assertAcessoProntuario(prestador, 'pet-1')).rejects.toMatchObject({ status: 404 })
  })

  it('clínica com consulta não cancelada do pet vê o prontuário (inclusive futura)', async () => {
    prismaMock.pet.findUnique.mockResolvedValueOnce(PET)
    prismaMock.agendamento.count.mockResolvedValueOnce(1)
    await expect(
      assertAcessoProntuario(user({ userType: 'clinica', clinica: { id: 'cli-1' } as never }), 'pet-1')
    ).resolves.toBe(PET)
    expect(prismaMock.agendamento.count).toHaveBeenCalledWith({
      where: { petId: 'pet-1', status: { notIn: ['cancelado', 'cancelada'] }, clinicaId: 'cli-1' },
    })
    expect(prismaMock.encaminhamento.count).not.toHaveBeenCalled()
  })

  it('vet sem consulta, mas destino de encaminhamento do pet, vê o prontuário', async () => {
    const vet = user({ userType: 'veterinario', veterinario: { id: 'vet-9' } as never })
    prismaMock.pet.findUnique.mockResolvedValueOnce(PET)
    prismaMock.agendamento.count.mockResolvedValueOnce(0)
    prismaMock.encaminhamento.count.mockResolvedValueOnce(1)
    await expect(assertAcessoProntuario(vet, 'pet-1')).resolves.toBe(PET)
  })

  it('veterinário sem perfil (ou tipo desconhecido) não tem vínculo: 404', async () => {
    prismaMock.pet.findUnique.mockResolvedValueOnce(PET)
    await expect(assertAcessoProntuario(user({ userType: 'veterinario' }), 'pet-1')).rejects.toMatchObject({
      status: 404,
    })
    prismaMock.pet.findUnique.mockResolvedValueOnce(PET)
    await expect(assertAcessoProntuario(user({ userType: 'clinica' }), 'pet-1')).rejects.toMatchObject({
      status: 404,
    })
    expect(prismaMock.agendamento.count).not.toHaveBeenCalled()
  })
})

describe('prontuarioDoPet', () => {
  it('lista só consultas não canceladas, sem anotação privada, com nomes de fallback', async () => {
    prismaMock.agendamento.findMany.mockResolvedValueOnce([
      {
        id: 'ag-2',
        dataConsulta: '2026-10-02',
        horarioConsulta: '10:00',
        tipoConsulta: 'presencial',
        status: 'realizado',
        localNome: 'Clínica X',
        veterinario: { user: { nome: 'Caio', sobrenome: 'Lima' } },
        clinica: { nomeClinica: 'Clínica X' },
        registroClinico: registro({ agendamentoId: 'ag-2' }),
      },
      {
        id: 'ag-3',
        dataConsulta: '2026-11-02',
        horarioConsulta: '09:00',
        tipoConsulta: 'online',
        status: 'confirmado',
        localNome: null,
        veterinario: { user: { nome: null, sobrenome: null } },
        clinica: null,
        registroClinico: null,
      },
    ])
    const lista = await prontuarioDoPet('pet-1')
    const args = prismaMock.agendamento.findMany.mock.calls[0][0]
    expect(args.where).toEqual({ petId: 'pet-1', status: { notIn: ['cancelado', 'cancelada'] } })
    expect(args.select).not.toHaveProperty('anotacao')
    expect(lista[0]).toMatchObject({ agendamento_id: 'ag-2', veterinario_nome: 'Caio Lima', clinica_nome: 'Clínica X' })
    expect(lista[0].registro).toMatchObject({ agendamento_id: 'ag-2', peso_kg: 12.5 })
    expect(lista[1]).toMatchObject({ agendamento_id: 'ag-3', veterinario_nome: null, clinica_nome: null, registro: null })
  })

  it('pet novo começa com prontuário vazio', async () => {
    prismaMock.agendamento.findMany.mockResolvedValueOnce([])
    await expect(prontuarioDoPet('pet-novo')).resolves.toEqual([])
  })
})

describe('serializePetProntuario', () => {
  it('expõe só os dados básicos do pet em snake_case', () => {
    expect(
      serializePetProntuario({
        id: 'pet-1',
        nome: 'Rex',
        especie: 'cão',
        raca: null,
        idade: 3,
        porte: 'médio',
        fotoUrl: '/rex.png',
        tutorId: 'tutor-a',
      } as never)
    ).toEqual({ id: 'pet-1', nome: 'Rex', especie: 'cão', raca: null, idade: 3, porte: 'médio', foto_url: '/rex.png' })
  })
})
