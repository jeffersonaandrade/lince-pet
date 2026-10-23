import { describe, it, expect, vi, beforeEach } from 'vitest'

const prismaMock = vi.hoisted(() => ({ agendamento: { findUnique: vi.fn() } }))
vi.mock('@/server/db', () => ({ prisma: prismaMock }))

const avisoMock = vi.hoisted(() => vi.fn())
vi.mock('@/server/services/aviso-usuario', () => ({ avisarUsuario: avisoMock }))

const googleMock = vi.hoisted(() => vi.fn())
vi.mock('@/server/services/google-calendar', () => ({ googleCalendar: { sincronizarEvento: googleMock } }))

import { avisarExame } from '@/server/services/exames-avisos'

const tutorUser = { id: 'u-tutor', nome: 'Ana', sobrenome: 'Lima', email: 'ana@x.com', notificarEmail: 1 }
const clinicaUser = { id: 'u-clinica', nome: 'Centro', email: 'c@x.com', notificarEmail: 1 }
const vetUser = { id: 'u-vet', nome: 'João', email: 'j@x.com', notificarEmail: 1 }

const exame = (over: Record<string, unknown> = {}) => ({
  id: 'ag-1',
  petId: 'p1',
  inicioEm: new Date('2026-11-02T13:00:00Z'),
  localNome: 'Clínica Centro',
  localEndereco: 'Rua A, 1',
  precoConsulta: '149.9',
  tutor: { user: tutorUser },
  pet: { nome: 'Rex' },
  clinica: { nomeClinica: 'Clínica Centro', user: clinicaUser },
  exames: [
    { nome: 'Hemograma', preparo: 'Jejum de 8h' },
    { nome: 'Raio-X', preparo: null },
  ],
  encaminhamentoOrigem: { origemVeterinario: { user: vetUser } },
  ...over,
})

const avisoPara = (userId: string) => avisoMock.mock.calls.find(([u]) => u.id === userId)?.[1]

beforeEach(() => {
  vi.clearAllMocks()
  prismaMock.agendamento.findUnique.mockResolvedValue(exame())
})

describe('avisarExame', () => {
  it('novo: tutor e clínica, com preparo e pagamento na clínica; cria evento no Google', async () => {
    await avisarExame('novo', 'ag-1')

    const tutor = avisoPara('u-tutor')
    expect(tutor).toMatchObject({ tipo: 'EXAME_AGENDADO', mensagem: expect.stringContaining('02/11/2026 às 10:00') })
    expect(tutor.detalhes).toEqual([
      ['Exames', 'Hemograma, Raio-X'],
      ['Pet', 'Rex'],
      ['Quando', '02/11/2026 às 10:00'],
      ['Local', 'Clínica Centro - Rua A, 1'],
      ['Valor', 'R$ 149.90 (pagamento na clínica)'],
      ['Preparo', 'Hemograma: Jejum de 8h'],
    ])
    expect(avisoPara('u-clinica')).toMatchObject({ tipo: 'EXAME_NOVO', mensagem: expect.stringContaining('Ana Lima agendou Hemograma, Raio-X') })
    expect(avisoPara('u-vet')).toBeUndefined()
    expect(googleMock).toHaveBeenCalledWith('ag-1', 'criar')
  })

  it('remarcado: tutor e clínica; atualiza o Google', async () => {
    await avisarExame('remarcado', 'ag-1')
    expect(avisoPara('u-tutor').tipo).toBe('EXAME_REMARCADO')
    expect(avisoPara('u-clinica').tipo).toBe('EXAME_REMARCADO')
    expect(googleMock).toHaveBeenCalledWith('ag-1', 'atualizar')
  })

  it('cancelado pelo tutor avisa a clínica; pela clínica avisa o tutor com o motivo', async () => {
    await avisarExame('cancelado_tutor', 'ag-1', 'Viagem')
    expect(avisoPara('u-clinica').mensagem).toContain('Motivo: Viagem')
    expect(avisoPara('u-tutor')).toBeUndefined()
    expect(googleMock).toHaveBeenCalledWith('ag-1', 'cancelar')

    avisoMock.mockClear()
    await avisarExame('cancelado_tutor', 'ag-1')
    expect(avisoPara('u-clinica').mensagem).not.toContain('Motivo')

    avisoMock.mockClear()
    await avisarExame('cancelado_clinica', 'ag-1', 'Aparelho em manutenção')
    expect(avisoPara('u-tutor').mensagem).toContain('Motivo: Aparelho em manutenção')
    avisoMock.mockClear()
    await avisarExame('cancelado_clinica', 'ag-1')
    expect(avisoPara('u-tutor').mensagem).toContain('não informado')
  })

  it('laudo: tutor e vet que encaminhou, com link para o prontuário; sem Google', async () => {
    await avisarExame('laudo', 'ag-1')
    expect(avisoPara('u-tutor')).toMatchObject({ tipo: 'LAUDO_DISPONIVEL', actionData: { petId: 'p1', url: '/dashboard/tutor' } })
    expect(avisoPara('u-vet')).toMatchObject({ tipo: 'LAUDO_DISPONIVEL', actionData: { url: '/dashboard/veterinario' } })
    expect(avisoPara('u-clinica')).toBeUndefined()
    expect(googleMock).not.toHaveBeenCalled()
  })

  it('dados faltando viram textos padrão', async () => {
    prismaMock.agendamento.findUnique.mockResolvedValue(
      exame({ inicioEm: null, localNome: null, localEndereco: null, precoConsulta: null, pet: null, clinica: { nomeClinica: null, user: clinicaUser }, tutor: { user: { ...tutorUser, sobrenome: null } }, exames: [], encaminhamentoOrigem: null })
    )
    await avisarExame('novo', 'ag-1')
    const tutor = avisoPara('u-tutor')
    expect(tutor.mensagem).toContain('seu pet')
    expect(tutor.mensagem).toContain('a clínica')
    expect(tutor.detalhes).toContainEqual(['Exames', 'Exame'])
    expect(tutor.detalhes).toContainEqual(['Local', null])
    expect(tutor.detalhes).toContainEqual(['Preparo', null])
    expect(avisoPara('u-clinica').mensagem).toContain('Ana agendou')

    prismaMock.agendamento.findUnique.mockResolvedValue(exame({ tutor: null }))
    avisoMock.mockClear()
    await avisarExame('novo', 'ag-1')
    expect(avisoPara('u-clinica').mensagem).toContain('Tutor agendou')
  })

  it('agendamento sumiu: nada; erro nunca lança', async () => {
    prismaMock.agendamento.findUnique.mockResolvedValueOnce(null)
    await avisarExame('novo', 'ag-1')
    expect(avisoMock).not.toHaveBeenCalled()

    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    prismaMock.agendamento.findUnique.mockRejectedValueOnce(new Error('db down'))
    await expect(avisarExame('novo', 'ag-1')).resolves.toBeUndefined()
    expect(log).toHaveBeenCalled()
    log.mockRestore()
  })
})
