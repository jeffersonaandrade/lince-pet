import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { CurrentUser } from '@/server/auth/session'

const prismaMock = vi.hoisted(() => ({
  agendamento: { findFirst: vi.fn(), count: vi.fn() },
  veterinario: { findFirst: vi.fn() },
  clinica: { findFirst: vi.fn() },
  prestador: { findFirst: vi.fn() },
  pet: { findUnique: vi.fn() },
  encaminhamento: {
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    count: vi.fn(),
  },
}))
vi.mock('@/server/db', () => ({ prisma: prismaMock }))

const afterMock = vi.hoisted(() => vi.fn())
vi.mock('next/server', async (importOriginal) => ({
  ...(await importOriginal<typeof import('next/server')>()),
  after: afterMock,
}))

const inAppMock = vi.hoisted(() => vi.fn())
vi.mock('@/server/services/in-app-notifications', () => ({
  inAppNotifications: { createGenericNotification: inAppMock },
}))
const emailMock = vi.hoisted(() => vi.fn())
vi.mock('@/server/services/notifications', () => ({ notifications: { sendPedidoServico: emailMock } }))
const whatsappMock = vi.hoisted(() => vi.fn())
vi.mock('@/server/services/whatsapp-notificacoes', () => ({ notificarTutorAvulso: whatsappMock }))

import {
  MENSAGEM_ANTES_DO_ATENDIMENTO,
  aceitarEncaminhamento,
  avisarEncaminhamento,
  conferirEncaminhamento,
  criarEncaminhamento,
  encaminhamentosAceitosDoPet,
  listarRecebidos,
  recusarEncaminhamento,
} from '@/server/services/encaminhamentos'
import { assertAcessoProntuario } from '@/server/services/prontuario'

const user = (u: Partial<CurrentUser>) =>
  ({ tutor: null, veterinario: null, clinica: null, prestador: null, ...u }) as CurrentUser
const VET = user({ userType: 'veterinario', veterinario: { id: 'vet-1' } as never })
const CLINICA = user({ userType: 'clinica', clinica: { id: 'cli-1' } as never })
const PRESTADOR = user({ userType: 'prestador', prestador: { id: 'pr-1' } as never })
const TUTOR = user({ userType: 'tutor', tutor: { id: 'tutor-a' } as never })

const CONSULTA = {
  id: 'ag-1',
  petId: 'pet-1',
  tutorId: 'tutor-a',
  veterinarioId: 'vet-1',
  clinicaId: 'cli-1',
  status: 'realizado',
  startedAt: new Date(),
}
const BODY = { destino_tipo: 'clinica', destino_id: 'cli-2', motivo: 'Avaliação cardiológica', urgencia: 'prioritario' }

const usuario = (id: string, nome: string) => ({ id, nome, sobrenome: null, email: `${id}@x.com`, notificarEmail: 1 })

/** Encaminhamento com os includes que o serviço usa. */
function enc(over: Record<string, unknown> = {}) {
  return {
    id: 'enc-1',
    petId: 'pet-1',
    tutorId: 'tutor-a',
    agendamentoOrigemId: 'ag-1',
    origemVeterinarioId: 'vet-1',
    origemClinicaId: null,
    destinoTipo: 'clinica',
    destinoVeterinarioId: null,
    destinoClinicaId: 'cli-2',
    destinoPrestadorId: null,
    motivo: 'Avaliação cardiológica',
    urgencia: 'rotina',
    status: 'enviado',
    motivoRecusa: null,
    respondidoEm: null,
    agendamentoDestinoId: null,
    createdAt: new Date(),
    pet: { id: 'pet-1', nome: 'Rex', especie: 'cão', raca: null },
    tutor: { user: usuario('u-tutor', 'Ana') },
    agendamentoOrigem: { id: 'ag-1', dataConsulta: '2026-10-01' },
    origemVeterinario: { user: usuario('u-vet', 'Caio') },
    origemClinica: null,
    destinoVeterinario: null,
    destinoClinica: { nomeClinica: 'Clínica Cardio', user: usuario('u-cli2', 'Cardio') },
    destinoPrestador: null,
    agendamentoDestino: null,
    ...over,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  prismaMock.agendamento.findFirst.mockResolvedValue(CONSULTA)
  prismaMock.clinica.findFirst.mockResolvedValue({ id: 'cli-2' })
  prismaMock.encaminhamento.findFirst.mockResolvedValue(null)
  prismaMock.encaminhamento.create.mockImplementation(async ({ data }) => enc(data))
})

describe('criarEncaminhamento', () => {
  it('vet da consulta encaminha para outra clínica com status enviado e origem da consulta', async () => {
    const r = await criarEncaminhamento(VET, 'ag-1', BODY)
    expect(r.status).toBe('enviado')
    const data = prismaMock.encaminhamento.create.mock.calls[0][0].data
    expect(data).toMatchObject({
      petId: 'pet-1',
      tutorId: 'tutor-a',
      agendamentoOrigemId: 'ag-1',
      origemVeterinarioId: 'vet-1',
      origemClinicaId: 'cli-1',
      destinoTipo: 'clinica',
      destinoClinicaId: 'cli-2',
      urgencia: 'prioritario',
      status: 'enviado',
    })
    expect(afterMock).toHaveBeenCalledTimes(1)
  })

  it('só busca a consulta do próprio vet ou da própria clínica', async () => {
    await criarEncaminhamento(VET, 'ag-1', BODY)
    expect(prismaMock.agendamento.findFirst.mock.calls[0][0].where).toEqual({ id: 'ag-1', veterinarioId: 'vet-1' })
    await criarEncaminhamento(CLINICA, 'ag-1', { ...BODY, destino_id: 'cli-9' })
    expect(prismaMock.agendamento.findFirst.mock.calls[1][0].where).toEqual({ id: 'ag-1', clinicaId: 'cli-1' })
  })

  it('aceita destino veterinário e prestador', async () => {
    prismaMock.veterinario.findFirst.mockResolvedValue({ id: 'vet-2' })
    prismaMock.prestador.findFirst.mockResolvedValue({ id: 'pr-1' })
    await criarEncaminhamento(VET, 'ag-1', { ...BODY, destino_tipo: 'veterinario', destino_id: 'vet-2' })
    await criarEncaminhamento(VET, 'ag-1', { ...BODY, destino_tipo: 'prestador', destino_id: 'pr-1' })
    expect(prismaMock.encaminhamento.create.mock.calls[0][0].data.destinoVeterinarioId).toBe('vet-2')
    expect(prismaMock.encaminhamento.create.mock.calls[1][0].data.destinoPrestadorId).toBe('pr-1')
  })

  it('tutor e prestador não encaminham (403)', async () => {
    await expect(criarEncaminhamento(TUTOR, 'ag-1', BODY)).rejects.toMatchObject({ status: 403 })
    await expect(criarEncaminhamento(PRESTADOR, 'ag-1', BODY)).rejects.toMatchObject({ status: 403 })
  })

  it('consulta de outro profissional: 404', async () => {
    prismaMock.agendamento.findFirst.mockResolvedValue(null)
    await expect(criarEncaminhamento(VET, 'ag-x', BODY)).rejects.toMatchObject({ status: 404 })
  })

  it('antes do início do atendimento ou em consulta cancelada: 400', async () => {
    prismaMock.agendamento.findFirst.mockResolvedValue({ ...CONSULTA, status: 'confirmado', startedAt: null })
    await expect(criarEncaminhamento(VET, 'ag-1', BODY)).rejects.toMatchObject({
      status: 400,
      body: { message: MENSAGEM_ANTES_DO_ATENDIMENTO },
    })
    prismaMock.agendamento.findFirst.mockResolvedValue({ ...CONSULTA, status: 'cancelado' })
    await expect(criarEncaminhamento(VET, 'ag-1', BODY)).rejects.toMatchObject({ status: 400 })
    expect(prismaMock.encaminhamento.create).not.toHaveBeenCalled()
  })

  it('não encaminha para si mesmo', async () => {
    prismaMock.veterinario.findFirst.mockResolvedValue({ id: 'vet-1' })
    await expect(
      criarEncaminhamento(VET, 'ag-1', { ...BODY, destino_tipo: 'veterinario', destino_id: 'vet-1' })
    ).rejects.toMatchObject({ status: 400 })
    await expect(
      criarEncaminhamento(CLINICA, 'ag-1', { ...BODY, destino_tipo: 'clinica', destino_id: 'cli-1' })
    ).rejects.toMatchObject({ status: 400 })
  })

  it('destino inexistente ou inativo: 404', async () => {
    prismaMock.clinica.findFirst.mockResolvedValue(null)
    await expect(criarEncaminhamento(VET, 'ag-1', BODY)).rejects.toMatchObject({ status: 404 })
  })

  it('duplicado aguardando resposta do mesmo destino: 409', async () => {
    prismaMock.encaminhamento.findFirst.mockResolvedValue({ id: 'enc-0' })
    await expect(criarEncaminhamento(VET, 'ag-1', BODY)).rejects.toMatchObject({ status: 409 })
    expect(prismaMock.encaminhamento.findFirst.mock.calls[0][0].where).toEqual({
      agendamentoOrigemId: 'ag-1',
      status: 'enviado',
      destinoClinicaId: 'cli-2',
    })
  })

  it('motivo obrigatório', async () => {
    await expect(criarEncaminhamento(VET, 'ag-1', { ...BODY, motivo: ' ' })).rejects.toBeTruthy()
    expect(prismaMock.encaminhamento.create).not.toHaveBeenCalled()
  })
})

describe('aceitar e recusar', () => {
  it('destino aceita: status aceito e aviso em background', async () => {
    prismaMock.encaminhamento.findFirst.mockResolvedValue(enc())
    prismaMock.encaminhamento.update.mockResolvedValue(enc({ status: 'aceito' }))
    const r = await aceitarEncaminhamento(user({ userType: 'clinica', clinica: { id: 'cli-2' } as never }), 'enc-1')
    expect(r.status).toBe('aceito')
    expect(prismaMock.encaminhamento.findFirst.mock.calls[0][0].where).toEqual({ id: 'enc-1', destinoClinicaId: 'cli-2' })
    expect(prismaMock.encaminhamento.update.mock.calls[0][0].data.status).toBe('aceito')
    expect(afterMock).toHaveBeenCalledTimes(1)
  })

  it('quem não é o destino recebe 404; tutor também', async () => {
    await expect(aceitarEncaminhamento(VET, 'enc-1')).rejects.toMatchObject({ status: 404 })
    await expect(aceitarEncaminhamento(TUTOR, 'enc-1')).rejects.toMatchObject({ status: 404 })
  })

  it('já respondido: 400', async () => {
    prismaMock.encaminhamento.findFirst.mockResolvedValue(enc({ status: 'aceito' }))
    await expect(aceitarEncaminhamento(PRESTADOR, 'enc-1')).rejects.toMatchObject({ status: 400 })
  })

  it('recusa exige motivo (422) e grava o motivo', async () => {
    await expect(recusarEncaminhamento(PRESTADOR, 'enc-1', ' a ')).rejects.toMatchObject({ status: 422 })
    prismaMock.encaminhamento.findFirst.mockResolvedValue(enc())
    prismaMock.encaminhamento.update.mockResolvedValue(enc({ status: 'recusado', motivoRecusa: 'Agenda cheia' }))
    const r = await recusarEncaminhamento(PRESTADOR, 'enc-1', '  Agenda cheia ')
    expect(r).toMatchObject({ status: 'recusado', motivo_recusa: 'Agenda cheia' })
    expect(prismaMock.encaminhamento.update.mock.calls[0][0].data).toMatchObject({
      status: 'recusado',
      motivoRecusa: 'Agenda cheia',
    })
  })

  it('lista de recebidos filtra pelo destino; tutor não recebe (403)', async () => {
    prismaMock.encaminhamento.findMany.mockResolvedValue([enc()])
    await listarRecebidos(PRESTADOR, 'enviado')
    expect(prismaMock.encaminhamento.findMany.mock.calls[0][0].where).toEqual({
      destinoPrestadorId: 'pr-1',
      status: 'enviado',
    })
    await expect(listarRecebidos(TUTOR)).rejects.toMatchObject({ status: 403 })
  })
})

describe('conferirEncaminhamento (tutor agenda no destino)', () => {
  const alvo = { tutorId: 'tutor-a', petId: 'pet-1' }

  it('libera o agendamento no destino certo para os 3 tipos', async () => {
    prismaMock.encaminhamento.findUnique.mockResolvedValue(enc({ status: 'aceito' }))
    await expect(conferirEncaminhamento('enc-1', { ...alvo, clinicaId: 'cli-2', veterinarioId: 'vet-9' })).resolves.toBeTruthy()

    prismaMock.encaminhamento.findUnique.mockResolvedValue(
      enc({ status: 'aceito', destinoTipo: 'veterinario', destinoClinicaId: null, destinoVeterinarioId: 'vet-2' })
    )
    await expect(conferirEncaminhamento('enc-1', { ...alvo, veterinarioId: 'vet-2' })).resolves.toBeTruthy()

    prismaMock.encaminhamento.findUnique.mockResolvedValue(
      enc({ status: 'aceito', destinoTipo: 'prestador', destinoClinicaId: null, destinoPrestadorId: 'pr-1' })
    )
    await expect(conferirEncaminhamento('enc-1', { ...alvo, prestadorId: 'pr-1' })).resolves.toBeTruthy()
  })

  it('outro destino: 400', async () => {
    prismaMock.encaminhamento.findUnique.mockResolvedValue(enc({ status: 'aceito' }))
    await expect(conferirEncaminhamento('enc-1', { ...alvo, clinicaId: 'cli-3' })).rejects.toMatchObject({ status: 400 })
    await expect(conferirEncaminhamento('enc-1', { ...alvo, prestadorId: 'cli-2' })).rejects.toMatchObject({ status: 400 })
  })

  it('ainda não aceito ou recusado: 400', async () => {
    prismaMock.encaminhamento.findUnique.mockResolvedValue(enc())
    await expect(conferirEncaminhamento('enc-1', { ...alvo, clinicaId: 'cli-2' })).rejects.toMatchObject({ status: 400 })
    prismaMock.encaminhamento.findUnique.mockResolvedValue(enc({ status: 'recusado' }))
    await expect(conferirEncaminhamento('enc-1', { ...alvo, clinicaId: 'cli-2' })).rejects.toMatchObject({ status: 400 })
  })

  it('de outro tutor: 404; de outro pet: 400', async () => {
    prismaMock.encaminhamento.findUnique.mockResolvedValue(enc({ status: 'aceito' }))
    await expect(
      conferirEncaminhamento('enc-1', { tutorId: 'tutor-b', petId: 'pet-1', clinicaId: 'cli-2' })
    ).rejects.toMatchObject({ status: 404 })
    await expect(
      conferirEncaminhamento('enc-1', { tutorId: 'tutor-a', petId: 'pet-2', clinicaId: 'cli-2' })
    ).rejects.toMatchObject({ status: 400 })
  })

  it('já agendado: 409; agendamento cancelado libera de novo', async () => {
    prismaMock.encaminhamento.findUnique.mockResolvedValue(enc({ status: 'aceito', agendamentoDestino: { status: 'confirmado' } }))
    await expect(conferirEncaminhamento('enc-1', { ...alvo, clinicaId: 'cli-2' })).rejects.toMatchObject({ status: 409 })
    prismaMock.encaminhamento.findUnique.mockResolvedValue(enc({ status: 'aceito', agendamentoDestino: { status: 'cancelado' } }))
    await expect(conferirEncaminhamento('enc-1', { ...alvo, clinicaId: 'cli-2' })).resolves.toBeTruthy()
  })
})

describe('prontuário', () => {
  beforeEach(() => {
    prismaMock.pet.findUnique.mockResolvedValue({ id: 'pet-1', tutorId: 'tutor-a' })
  })

  it('prestador destino de encaminhamento enviado ou aceito vê o prontuário', async () => {
    prismaMock.encaminhamento.count.mockResolvedValue(1)
    await expect(assertAcessoProntuario(PRESTADOR, 'pet-1')).resolves.toBeTruthy()
    expect(prismaMock.encaminhamento.count).toHaveBeenCalledWith({
      where: { petId: 'pet-1', status: { in: ['enviado', 'aceito'] }, destinoPrestadorId: 'pr-1' },
    })
  })

  it('clínica destino sem consulta própria também vê', async () => {
    prismaMock.agendamento.count.mockResolvedValue(0)
    prismaMock.encaminhamento.count.mockResolvedValue(1)
    await expect(
      assertAcessoProntuario(user({ userType: 'clinica', clinica: { id: 'cli-2' } as never }), 'pet-1')
    ).resolves.toBeTruthy()
  })

  it('sem encaminhamento ativo (ex.: recusado) e sem consulta: 404', async () => {
    prismaMock.agendamento.count.mockResolvedValue(0)
    prismaMock.encaminhamento.count.mockResolvedValue(0)
    await expect(assertAcessoProntuario(PRESTADOR, 'pet-1')).rejects.toMatchObject({ status: 404 })
  })

  it('aceitos do pet entram no prontuário com origem e destino', async () => {
    prismaMock.encaminhamento.findMany.mockResolvedValue([enc({ status: 'aceito' })])
    const [e] = await encaminhamentosAceitosDoPet('pet-1')
    expect(prismaMock.encaminhamento.findMany.mock.calls[0][0].where).toEqual({ petId: 'pet-1', status: 'aceito' })
    expect(e).toMatchObject({
      status: 'aceito',
      origem: { nome: 'Dr(a). Caio' },
      destino: { tipo: 'clinica', nome: 'Clínica Cardio', link: '/clinicas/cli-2' },
    })
    expect(e.destino).not.toHaveProperty('user')
  })
})

describe('avisos', () => {
  it('novo: avisa destino e tutor no sino e por e-mail', async () => {
    prismaMock.encaminhamento.findFirst.mockResolvedValue(enc())
    await avisarEncaminhamento('novo', 'enc-1')
    const destinatarios = inAppMock.mock.calls.map((c) => c[0].userId)
    expect(destinatarios).toEqual(['u-cli2', 'u-tutor'])
    expect(inAppMock.mock.calls[0][0].type).toBe('ENCAMINHAMENTO_NOVO')
    expect(emailMock).toHaveBeenCalledTimes(2)
    expect(whatsappMock).not.toHaveBeenCalled()
  })

  it('aceito: avisa tutor e origem e manda WhatsApp ao tutor', async () => {
    prismaMock.encaminhamento.findFirst.mockResolvedValue(enc({ status: 'aceito' }))
    await avisarEncaminhamento('aceito', 'enc-1')
    expect(inAppMock.mock.calls.map((c) => c[0].userId)).toEqual(['u-tutor', 'u-vet'])
    expect(inAppMock.mock.calls[0][0].type).toBe('ENCAMINHAMENTO_ACEITO')
    expect(whatsappMock).toHaveBeenCalledWith('ag-1', 'encaminhamento_aceito', 'enc-1', expect.stringContaining('aceitou'))
  })

  it('falha de aviso nunca lança', async () => {
    prismaMock.encaminhamento.findFirst.mockRejectedValue(new Error('db fora'))
    await expect(avisarEncaminhamento('recusado', 'enc-1')).resolves.toBeUndefined()
  })
})
