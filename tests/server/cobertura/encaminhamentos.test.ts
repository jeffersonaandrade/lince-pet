import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { CurrentUser } from '@/server/auth/session'

const prismaMock = vi.hoisted(() => ({
  agendamento: { findFirst: vi.fn() },
  veterinario: { findFirst: vi.fn() },
  clinica: { findFirst: vi.fn() },
  prestador: { findFirst: vi.fn() },
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
  aceitarEncaminhamento,
  avisarEncaminhamento,
  conferirEncaminhamento,
  criarEncaminhamento,
  destinoDe,
  destinoDoUsuario,
  encaminhamentosAceitosDoPet,
  listarDoTutor,
  listarEnviados,
  listarRecebidos,
  origemDe,
  recebeuEncaminhamentoDoPet,
  recusarEncaminhamento,
  serializarEncaminhamento,
  vincularAgendamento,
} from '@/server/services/encaminhamentos'

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
  clinicaId: null,
  status: 'realizado',
  startedAt: new Date(),
}

const usuario = (id: string, nome: string, over: Record<string, unknown> = {}) => ({
  id,
  nome,
  sobrenome: null,
  email: `${id}@x.com`,
  notificarEmail: 1,
  profilePic: null,
  ...over,
})

function enc(over: Record<string, unknown> = {}) {
  return {
    id: 'enc-1234567890-abcdefghij-xyz',
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
    createdAt: new Date('2026-10-01T12:00:00Z'),
    pet: { id: 'pet-1', nome: 'Rex', especie: 'cão', raca: 'SRD' },
    tutor: { user: usuario('u-tutor', 'Ana') },
    agendamentoOrigem: { id: 'ag-1', dataConsulta: '2026-10-01' },
    origemVeterinario: { user: usuario('u-vet', 'Caio') },
    origemClinica: null,
    destinoVeterinario: null,
    destinoClinica: { nomeClinica: 'Clínica Cardio', nomeFantasia: null, fotoPerfil: null, user: usuario('u-cli2', 'Cardio') },
    destinoPrestador: null,
    agendamentoDestino: null,
    ...over,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('destinoDoUsuario', () => {
  it('mapeia vet, clínica e prestador; tutor ou perfil ausente não recebe', () => {
    expect(destinoDoUsuario(VET)).toEqual({ destinoVeterinarioId: 'vet-1' })
    expect(destinoDoUsuario(CLINICA)).toEqual({ destinoClinicaId: 'cli-1' })
    expect(destinoDoUsuario(PRESTADOR)).toEqual({ destinoPrestadorId: 'pr-1' })
    expect(destinoDoUsuario(TUTOR)).toBeNull()
    expect(destinoDoUsuario(user({ userType: 'prestador' }))).toBeNull()
  })
})

describe('destinoDe / origemDe', () => {
  it('clínica: usa nomeClinica, depois nomeFantasia, nome do usuário e por fim "Clínica"', () => {
    expect(destinoDe(enc() as never)).toMatchObject({ tipo: 'clinica', nome: 'Clínica Cardio', link: '/clinicas/cli-2' })
    expect(
      destinoDe(enc({ destinoClinica: { nomeClinica: null, nomeFantasia: 'Cardio Pet', user: null } }) as never).nome
    ).toBe('Cardio Pet')
    const semNome = destinoDe(
      enc({ destinoClinica: { nomeClinica: null, nomeFantasia: null, fotoPerfil: null, user: usuario('u', 'Beatriz', { profilePic: '/b.png' }) } }) as never
    )
    expect(semNome).toMatchObject({ nome: 'Beatriz', foto_url: '/b.png' })
    expect(destinoDe(enc({ destinoClinica: null }) as never)).toMatchObject({ nome: 'Clínica', foto_url: null, user: null })
  })

  it('prestador: nome do usuário e tipo de serviço, com fallbacks', () => {
    const p = destinoDe(
      enc({
        destinoTipo: 'prestador',
        destinoClinicaId: null,
        destinoPrestadorId: 'pr-1',
        destinoPrestador: { fotoUrl: '/p.png', tipoServico: { nome: 'Banho e tosa' }, user: usuario('u-pr', 'Lia') },
      }) as never
    )
    expect(p).toMatchObject({ tipo: 'prestador', id: 'pr-1', nome: 'Lia', rotulo: 'Banho e tosa', foto_url: '/p.png', link: '/profissionais/pr-1' })
    const vazio = destinoDe(enc({ destinoTipo: 'prestador', destinoPrestadorId: 'pr-1', destinoPrestador: null }) as never)
    expect(vazio).toMatchObject({ nome: 'Profissional', rotulo: 'Profissional pet', foto_url: null, user: null })
    const semFoto = destinoDe(
      enc({ destinoTipo: 'prestador', destinoPrestador: { fotoUrl: null, tipoServico: null, user: usuario('u', 'Lia', { profilePic: '/u.png' }) } }) as never
    )
    expect(semFoto.foto_url).toBe('/u.png')
  })

  it('veterinário: nome, foto e fallback "Veterinário(a)"', () => {
    const v = destinoDe(
      enc({
        destinoTipo: 'veterinario',
        destinoVeterinarioId: 'vet-2',
        destinoVeterinario: { fotoUrl: null, user: usuario('u-v2', 'Rui', { profilePic: '/r.png' }) },
      }) as never
    )
    expect(v).toMatchObject({ tipo: 'veterinario', id: 'vet-2', nome: 'Rui', foto_url: '/r.png', link: '/veterinario/vet-2' })
    expect(destinoDe(enc({ destinoTipo: 'veterinario', destinoVeterinario: null }) as never)).toMatchObject({
      nome: 'Veterinário(a)',
      foto_url: null,
      user: null,
    })
  })

  it('origem: prioriza "Dr(a). vet", senão clínica, senão "Profissional"; junta os usuários a avisar', () => {
    expect(origemDe(enc() as never)).toMatchObject({ nome: 'Dr(a). Caio', clinica_nome: null })
    const soClinica = origemDe(
      enc({ origemVeterinario: null, origemClinica: { nomeClinica: null, nomeFantasia: 'Pet Center', user: usuario('u-c', 'PC') } }) as never
    )
    expect(soClinica).toMatchObject({ nome: 'Pet Center', veterinario_nome: null, clinica_nome: 'Pet Center' })
    expect(soClinica.users.map((u) => u.id)).toEqual(['u-c'])
    expect(origemDe(enc({ origemVeterinario: null, origemClinica: null }) as never)).toMatchObject({
      nome: 'Profissional',
      users: [],
    })
  })
})

describe('serializarEncaminhamento', () => {
  it('não expõe usuários internos e inclui o agendamento marcado no destino', () => {
    const s = serializarEncaminhamento(
      enc({
        status: 'aceito',
        respondidoEm: new Date('2026-10-02T12:00:00Z'),
        agendamentoDestino: { id: 'ag-9', status: 'confirmado', dataConsulta: '2026-10-20', horarioConsulta: '10:00' },
      }) as never
    )
    expect(s).toMatchObject({
      status: 'aceito',
      criado_em: '2026-10-01T12:00:00.000Z',
      respondido_em: '2026-10-02T12:00:00.000Z',
      pet: { id: 'pet-1', nome: 'Rex', especie: 'cão', raca: 'SRD' },
      tutor: { nome: 'Ana' },
      origem: { nome: 'Dr(a). Caio', agendamento_id: 'ag-1', data_consulta: '2026-10-01' },
      agendamento_destino: { id: 'ag-9', status: 'confirmado', data: '2026-10-20', horario: '10:00' },
    })
    expect(s.destino).not.toHaveProperty('user')
    expect(s.origem).not.toHaveProperty('users')
  })

  it('campos ausentes viram null', () => {
    const s = serializarEncaminhamento(enc({ createdAt: null, pet: null, tutor: null, agendamentoOrigem: null }) as never)
    expect(s).toMatchObject({ criado_em: null, respondido_em: null, pet: null, tutor: null, agendamento_destino: null })
    expect(s.origem.data_consulta).toBeNull()
  })
})

describe('criarEncaminhamento', () => {
  const BODY = { destino_tipo: 'veterinario', destino_id: 'vet-2', motivo: 'Avaliação ortopédica' }

  it('só vet ou clínica encaminham (tutor e prestador: 403)', async () => {
    await expect(criarEncaminhamento(TUTOR, 'ag-1', BODY)).rejects.toMatchObject({ status: 403 })
    await expect(criarEncaminhamento(PRESTADOR, 'ag-1', BODY)).rejects.toMatchObject({ status: 403 })
    expect(prismaMock.agendamento.findFirst).not.toHaveBeenCalled()
  })

  it('consulta que não é do usuário: 404; sem pet ou tutor: 400', async () => {
    prismaMock.agendamento.findFirst.mockResolvedValueOnce(null)
    await expect(criarEncaminhamento(VET, 'ag-1', BODY)).rejects.toMatchObject({ status: 404 })
    expect(prismaMock.agendamento.findFirst).toHaveBeenCalledWith({ where: { id: 'ag-1', veterinarioId: 'vet-1' } })

    prismaMock.agendamento.findFirst.mockResolvedValueOnce({ ...CONSULTA, tutorId: null })
    await expect(criarEncaminhamento(VET, 'ag-1', BODY)).rejects.toMatchObject({
      status: 400,
      message: 'Consulta sem pet vinculado',
    })
  })

  it('consulta cancelada não encaminha (400)', async () => {
    prismaMock.agendamento.findFirst.mockResolvedValueOnce({ ...CONSULTA, status: 'cancelado' })
    await expect(criarEncaminhamento(VET, 'ag-1', BODY)).rejects.toMatchObject({ status: 400 })
  })

  it('não pode encaminhar para si mesmo (vet e clínica)', async () => {
    prismaMock.agendamento.findFirst.mockResolvedValueOnce(CONSULTA)
    await expect(
      criarEncaminhamento(VET, 'ag-1', { ...BODY, destino_id: 'vet-1' })
    ).rejects.toMatchObject({ status: 400, message: 'Escolha um destino diferente de você' })

    prismaMock.agendamento.findFirst.mockResolvedValueOnce({ ...CONSULTA, clinicaId: 'cli-1' })
    await expect(
      criarEncaminhamento(CLINICA, 'ag-1', { ...BODY, destino_tipo: 'clinica', destino_id: 'cli-1' })
    ).rejects.toMatchObject({ status: 400 })
    expect(prismaMock.agendamento.findFirst).toHaveBeenLastCalledWith({ where: { id: 'ag-1', clinicaId: 'cli-1' } })
  })

  it('destino precisa estar ativo: vet e prestador (com onboarding) inexistentes dão 404', async () => {
    prismaMock.agendamento.findFirst.mockResolvedValueOnce(CONSULTA)
    prismaMock.veterinario.findFirst.mockResolvedValueOnce(null)
    await expect(criarEncaminhamento(VET, 'ag-1', BODY)).rejects.toMatchObject({ status: 404 })
    expect(prismaMock.veterinario.findFirst).toHaveBeenCalledWith({
      where: { id: 'vet-2', user: { ativo: 1 } },
      select: { id: true },
    })

    prismaMock.agendamento.findFirst.mockResolvedValueOnce(CONSULTA)
    prismaMock.prestador.findFirst.mockResolvedValueOnce(null)
    await expect(
      criarEncaminhamento(VET, 'ag-1', { ...BODY, destino_tipo: 'prestador', destino_id: 'pr-1' })
    ).rejects.toMatchObject({ status: 404, message: 'Destino não encontrado' })
    expect(prismaMock.prestador.findFirst).toHaveBeenCalledWith({
      where: { id: 'pr-1', onboardingComplete: 1, user: { ativo: 1 } },
      select: { id: true },
    })
  })

  it('clínica de destino precisa ter usuário ativo', async () => {
    prismaMock.agendamento.findFirst.mockResolvedValueOnce(CONSULTA)
    prismaMock.clinica.findFirst.mockResolvedValueOnce(null)
    await expect(
      criarEncaminhamento(VET, 'ag-1', { ...BODY, destino_tipo: 'clinica', destino_id: 'cli-2' })
    ).rejects.toMatchObject({ status: 404 })
    expect(prismaMock.clinica.findFirst).toHaveBeenCalledWith({
      where: { id: 'cli-2', user: { ativo: 1 } },
      select: { id: true },
    })
  })

  it('duplicado enviado para o mesmo destino: 409', async () => {
    prismaMock.agendamento.findFirst.mockResolvedValueOnce(CONSULTA)
    prismaMock.prestador.findFirst.mockResolvedValueOnce({ id: 'pr-1' })
    prismaMock.encaminhamento.findFirst.mockResolvedValueOnce({ id: 'enc-0' })
    await expect(
      criarEncaminhamento(VET, 'ag-1', { ...BODY, destino_tipo: 'prestador', destino_id: 'pr-1' })
    ).rejects.toMatchObject({ status: 409 })
    expect(prismaMock.encaminhamento.findFirst).toHaveBeenCalledWith({
      where: { agendamentoOrigemId: 'ag-1', status: 'enviado', destinoPrestadorId: 'pr-1' },
      select: { id: true },
    })
    expect(prismaMock.encaminhamento.create).not.toHaveBeenCalled()
  })

  it('cria como enviado, urgência padrão rotina, e agenda o aviso "novo"', async () => {
    prismaMock.agendamento.findFirst.mockResolvedValueOnce(CONSULTA)
    prismaMock.veterinario.findFirst.mockResolvedValueOnce({ id: 'vet-2' })
    prismaMock.encaminhamento.findFirst.mockResolvedValueOnce(null)
    prismaMock.encaminhamento.create.mockImplementationOnce(async ({ data }) =>
      enc({ ...data, destinoClinicaId: null, destinoVeterinario: { user: usuario('u-v2', 'Rui') } })
    )
    const r = await criarEncaminhamento(VET, 'ag-1', BODY)
    const data = prismaMock.encaminhamento.create.mock.calls[0][0].data
    expect(data).toMatchObject({
      petId: 'pet-1',
      tutorId: 'tutor-a',
      agendamentoOrigemId: 'ag-1',
      origemVeterinarioId: 'vet-1',
      origemClinicaId: null,
      destinoTipo: 'veterinario',
      destinoVeterinarioId: 'vet-2',
      urgencia: 'rotina',
      status: 'enviado',
    })
    expect(r.destino).toMatchObject({ tipo: 'veterinario', nome: 'Rui' })
    expect(afterMock).toHaveBeenCalledTimes(1)

    prismaMock.encaminhamento.findFirst.mockResolvedValueOnce(null)
    await afterMock.mock.calls[0][0]()
    expect(prismaMock.encaminhamento.findFirst).toHaveBeenLastCalledWith(
      expect.objectContaining({ where: { id: data.id } })
    )
  })
})

describe('listagens', () => {
  it('enviados do vet, com ou sem filtro de consulta', async () => {
    prismaMock.encaminhamento.findMany.mockResolvedValueOnce([enc()])
    const lista = await listarEnviados(VET, 'ag-1')
    expect(lista).toHaveLength(1)
    expect(prismaMock.encaminhamento.findMany.mock.calls[0][0]).toMatchObject({
      where: { origemVeterinarioId: 'vet-1', agendamentoOrigemId: 'ag-1' },
      orderBy: [{ createdAt: 'desc' }],
    })
    prismaMock.encaminhamento.findMany.mockResolvedValueOnce([])
    await listarEnviados(CLINICA)
    expect(prismaMock.encaminhamento.findMany.mock.calls[1][0].where).toEqual({ origemClinicaId: 'cli-1' })
  })

  it('recebidos: tutor 403; prestador com filtro de status', async () => {
    await expect(listarRecebidos(TUTOR)).rejects.toMatchObject({ status: 403 })
    prismaMock.encaminhamento.findMany.mockResolvedValueOnce([])
    await listarRecebidos(PRESTADOR, 'enviado')
    expect(prismaMock.encaminhamento.findMany.mock.calls[0][0].where).toEqual({
      destinoPrestadorId: 'pr-1',
      status: 'enviado',
    })
    prismaMock.encaminhamento.findMany.mockResolvedValueOnce([])
    await listarRecebidos(CLINICA, null)
    expect(prismaMock.encaminhamento.findMany.mock.calls[1][0].where).toEqual({ destinoClinicaId: 'cli-1' })
  })

  it('do tutor: filtra pelo tutorId e serializa', async () => {
    prismaMock.encaminhamento.findMany.mockResolvedValueOnce([enc()])
    const lista = await listarDoTutor('tutor-a')
    expect(prismaMock.encaminhamento.findMany.mock.calls[0][0].where).toEqual({ tutorId: 'tutor-a' })
    expect(lista[0]).toMatchObject({ status: 'enviado', destino: { nome: 'Clínica Cardio' } })
  })
})

describe('resposta do destino', () => {
  it('só o destino responde: tutor e não-destino recebem 404', async () => {
    await expect(aceitarEncaminhamento(TUTOR, 'enc-1')).rejects.toMatchObject({ status: 404 })
    prismaMock.encaminhamento.findFirst.mockResolvedValueOnce(null)
    await expect(aceitarEncaminhamento(CLINICA, 'enc-1')).rejects.toMatchObject({ status: 404 })
    expect(prismaMock.encaminhamento.findFirst).toHaveBeenCalledWith({ where: { id: 'enc-1', destinoClinicaId: 'cli-1' } })
    expect(prismaMock.encaminhamento.update).not.toHaveBeenCalled()
  })

  it('só responde uma vez (já aceito/recusado: 400)', async () => {
    prismaMock.encaminhamento.findFirst.mockResolvedValueOnce(enc({ status: 'aceito' }))
    await expect(aceitarEncaminhamento(CLINICA, 'enc-1')).rejects.toMatchObject({
      status: 400,
      message: 'Este encaminhamento já foi respondido',
    })
  })

  it('aceitar grava status e data de resposta e agenda o aviso', async () => {
    prismaMock.encaminhamento.findFirst.mockResolvedValueOnce(enc())
    prismaMock.encaminhamento.update.mockResolvedValueOnce(enc({ status: 'aceito' }))
    const r = await aceitarEncaminhamento(CLINICA, 'enc-1')
    expect(r.status).toBe('aceito')
    const data = prismaMock.encaminhamento.update.mock.calls[0][0].data
    expect(data).toMatchObject({ status: 'aceito', respondidoEm: expect.any(Date) })
    expect(afterMock).toHaveBeenCalledTimes(1)
  })

  it('recusar exige motivo (>= 3 caracteres) e corta em 500', async () => {
    await expect(recusarEncaminhamento(CLINICA, 'enc-1', '  ok ')).rejects.toMatchObject({ status: 422 })
    await expect(recusarEncaminhamento(CLINICA, 'enc-1', null)).rejects.toMatchObject({ status: 422 })
    expect(prismaMock.encaminhamento.findFirst).not.toHaveBeenCalled()

    prismaMock.encaminhamento.findFirst.mockResolvedValueOnce(enc())
    prismaMock.encaminhamento.update.mockResolvedValueOnce(enc({ status: 'recusado', motivoRecusa: 'Sem agenda' }))
    const r = await recusarEncaminhamento(CLINICA, 'enc-1', `  ${'x'.repeat(600)}  `)
    expect(r.status).toBe('recusado')
    const data = prismaMock.encaminhamento.update.mock.calls[0][0].data
    expect(data).toMatchObject({ status: 'recusado', respondidoEm: expect.any(Date) })
    expect(data.motivoRecusa).toHaveLength(500)
    expect(afterMock).toHaveBeenCalledTimes(1)
  })
})

describe('conferirEncaminhamento (vínculo com o agendamento no destino)', () => {
  const ALVO = { tutorId: 'tutor-a', petId: 'pet-1', clinicaId: 'cli-2' }
  const aceito = (over: Record<string, unknown> = {}) => enc({ status: 'aceito', agendamentoDestino: null, ...over })

  it('inexistente ou de outro tutor: 404', async () => {
    prismaMock.encaminhamento.findUnique.mockResolvedValueOnce(null)
    await expect(conferirEncaminhamento('enc-1', ALVO)).rejects.toMatchObject({ status: 404 })
    prismaMock.encaminhamento.findUnique.mockResolvedValueOnce(aceito({ tutorId: 'tutor-b' }))
    await expect(conferirEncaminhamento('enc-1', ALVO)).rejects.toMatchObject({ status: 404 })
  })

  it('precisa estar aceito e ser do mesmo pet (400)', async () => {
    prismaMock.encaminhamento.findUnique.mockResolvedValueOnce(aceito({ status: 'enviado' }))
    await expect(conferirEncaminhamento('enc-1', ALVO)).rejects.toMatchObject({ status: 400 })
    prismaMock.encaminhamento.findUnique.mockResolvedValueOnce(aceito({ petId: 'pet-2' }))
    await expect(conferirEncaminhamento('enc-1', ALVO)).rejects.toMatchObject({
      status: 400,
      message: 'Este encaminhamento é de outro pet',
    })
  })

  it('agendamento ativo já vinculado: 409; cancelado libera nova marcação', async () => {
    prismaMock.encaminhamento.findUnique.mockResolvedValueOnce(aceito({ agendamentoDestino: { status: 'pendente' } }))
    await expect(conferirEncaminhamento('enc-1', ALVO)).rejects.toMatchObject({ status: 409 })
    prismaMock.encaminhamento.findUnique.mockResolvedValueOnce(aceito({ agendamentoDestino: { status: 'cancelada' } }))
    await expect(conferirEncaminhamento('enc-1', ALVO)).resolves.toMatchObject({ status: 'aceito' })
  })

  it('exige o mesmo destino para vet, clínica e prestador', async () => {
    prismaMock.encaminhamento.findUnique.mockResolvedValueOnce(aceito())
    await expect(conferirEncaminhamento('enc-1', { ...ALVO, clinicaId: 'cli-9' })).rejects.toMatchObject({
      status: 400,
      message: 'O agendamento precisa ser com o destino do encaminhamento',
    })
    prismaMock.encaminhamento.findUnique.mockResolvedValueOnce(aceito())
    await expect(conferirEncaminhamento('enc-1', { ...ALVO, clinicaId: null })).rejects.toMatchObject({ status: 400 })

    const paraVet = aceito({ destinoTipo: 'veterinario', destinoClinicaId: null, destinoVeterinarioId: 'vet-2' })
    prismaMock.encaminhamento.findUnique.mockResolvedValueOnce(paraVet)
    await expect(
      conferirEncaminhamento('enc-1', { tutorId: 'tutor-a', petId: 'pet-1', veterinarioId: 'vet-2' })
    ).resolves.toBe(paraVet)
    prismaMock.encaminhamento.findUnique.mockResolvedValueOnce(paraVet)
    await expect(
      conferirEncaminhamento('enc-1', { tutorId: 'tutor-a', petId: 'pet-1', veterinarioId: 'vet-3' })
    ).rejects.toMatchObject({ status: 400 })

    const paraPrestador = aceito({ destinoTipo: 'prestador', destinoClinicaId: null, destinoPrestadorId: 'pr-1' })
    prismaMock.encaminhamento.findUnique.mockResolvedValueOnce(paraPrestador)
    await expect(
      conferirEncaminhamento('enc-1', { tutorId: 'tutor-a', petId: 'pet-1', prestadorId: 'pr-1' })
    ).resolves.toBe(paraPrestador)
    prismaMock.encaminhamento.findUnique.mockResolvedValueOnce(paraPrestador)
    await expect(
      conferirEncaminhamento('enc-1', { tutorId: 'tutor-a', petId: 'pet-1', clinicaId: 'pr-1' })
    ).rejects.toMatchObject({ status: 400 })
  })
})

describe('vincularAgendamento e acesso ao prontuário', () => {
  it('liga o agendamento criado ao encaminhamento', async () => {
    prismaMock.encaminhamento.update.mockResolvedValueOnce({})
    await vincularAgendamento('enc-1', 'ag-9')
    expect(prismaMock.encaminhamento.update).toHaveBeenCalledWith({
      where: { id: 'enc-1' },
      data: expect.objectContaining({ agendamentoDestinoId: 'ag-9', updatedAt: expect.any(Date) }),
    })
  })

  it('tutor não é destino (false sem consultar); destino com enviado/aceito vê', async () => {
    await expect(recebeuEncaminhamentoDoPet(TUTOR, 'pet-1')).resolves.toBe(false)
    expect(prismaMock.encaminhamento.count).not.toHaveBeenCalled()
    prismaMock.encaminhamento.count.mockResolvedValueOnce(0)
    await expect(recebeuEncaminhamentoDoPet(VET, 'pet-1')).resolves.toBe(false)
    expect(prismaMock.encaminhamento.count).toHaveBeenCalledWith({
      where: { petId: 'pet-1', status: { in: ['enviado', 'aceito'] }, destinoVeterinarioId: 'vet-1' },
    })
  })
})

describe('encaminhamentosAceitosDoPet', () => {
  it('prontuário mostra só os encaminhamentos aceitos do pet, mais recentes primeiro', async () => {
    prismaMock.encaminhamento.findMany.mockResolvedValueOnce([enc({ status: 'aceito' })])
    const lista = await encaminhamentosAceitosDoPet('pet-1')
    expect(prismaMock.encaminhamento.findMany.mock.calls[0][0]).toMatchObject({
      where: { petId: 'pet-1', status: 'aceito' },
      orderBy: [{ createdAt: 'desc' }],
    })
    expect(lista).toEqual([expect.objectContaining({ status: 'aceito', motivo: 'Avaliação cardiológica' })])
  })
})

describe('avisarEncaminhamento', () => {
  it('encaminhamento inexistente: não avisa ninguém', async () => {
    prismaMock.encaminhamento.findFirst.mockResolvedValueOnce(null)
    await avisarEncaminhamento('novo', 'enc-x')
    expect(inAppMock).not.toHaveBeenCalled()
    expect(whatsappMock).not.toHaveBeenCalled()
  })

  it('"novo" avisa destino e tutor (sino + e-mail) e não manda WhatsApp', async () => {
    prismaMock.encaminhamento.findFirst.mockResolvedValueOnce(enc({ urgencia: 'prioritario' }))
    await avisarEncaminhamento('novo', 'enc-1')
    expect(inAppMock.mock.calls.map((c) => c[0].userId)).toEqual(['u-cli2', 'u-tutor'])
    expect(inAppMock.mock.calls[0][0]).toMatchObject({
      type: 'ENCAMINHAMENTO_NOVO',
      title: 'Novo encaminhamento',
      actionData: { encaminhamentoId: 'enc-1234567890-abcdefghij-xyz', petId: 'pet-1' },
    })
    expect(emailMock).toHaveBeenCalledTimes(2)
    expect(emailMock.mock.calls[0][2].detalhes).toContainEqual(['Urgência', 'Prioritário'])
    expect(whatsappMock).not.toHaveBeenCalled()
  })

  it('"novo" sem usuário de destino nem tutor não avisa ninguém', async () => {
    prismaMock.encaminhamento.findFirst.mockResolvedValueOnce(enc({ destinoClinica: null, tutor: null, pet: null }))
    await avisarEncaminhamento('novo', 'enc-1')
    expect(inAppMock).not.toHaveBeenCalled()
  })

  it('"recusado" avisa tutor e origem com o motivo e manda WhatsApp ao tutor', async () => {
    prismaMock.encaminhamento.findFirst.mockResolvedValueOnce(
      enc({
        status: 'recusado',
        motivoRecusa: 'Sem agenda',
        origemClinica: { nomeClinica: 'Pet Center', user: usuario('u-cli1', 'PC', { notificarEmail: 0 }) },
      })
    )
    await avisarEncaminhamento('recusado', 'enc-1')
    expect(inAppMock.mock.calls.map((c) => c[0].userId)).toEqual(['u-tutor', 'u-vet', 'u-cli1'])
    expect(inAppMock.mock.calls[0][0]).toMatchObject({
      type: 'ENCAMINHAMENTO_RECUSADO',
      title: 'Encaminhamento recusado',
      message: 'Clínica Cardio não poderá receber Rex. Motivo: Sem agenda',
    })
    // a clínica de origem desligou o e-mail
    expect(emailMock).toHaveBeenCalledTimes(2)
    expect(whatsappMock).toHaveBeenCalledWith(
      'ag-1',
      'encaminhamento_recusado',
      'enc-1234567890-abcde',
      expect.stringContaining('Clínica Cardio não poderá receber Rex')
    )
  })

  it('"recusado" sem motivo e sem tutor: avisa só a origem, com texto sem "undefined"', async () => {
    prismaMock.encaminhamento.findFirst.mockResolvedValueOnce(enc({ motivoRecusa: null, tutor: null, pet: null }))
    await avisarEncaminhamento('recusado', 'enc-1')
    expect(inAppMock.mock.calls.map((c) => c[0].userId)).toEqual(['u-vet'])
    expect(inAppMock.mock.calls[0][0].message).toBe('Clínica Cardio não poderá receber o pet. Motivo:')
    expect(emailMock.mock.calls[0][2].detalhes).toContainEqual(['Pet', null])
  })

  it('"aceito" pede ao tutor para agendar', async () => {
    prismaMock.encaminhamento.findFirst.mockResolvedValueOnce(enc({ status: 'aceito' }))
    await avisarEncaminhamento('aceito', 'enc-1')
    expect(inAppMock.mock.calls[0][0]).toMatchObject({
      userId: 'u-tutor',
      type: 'ENCAMINHAMENTO_ACEITO',
      message: 'Clínica Cardio aceitou o encaminhamento de Rex. Agende o atendimento pelo seu painel.',
    })
    expect(whatsappMock).toHaveBeenCalledWith('ag-1', 'encaminhamento_aceito', expect.any(String), expect.any(String))
  })

  it('falha ao avisar um usuário é registrada e não impede os demais', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    prismaMock.encaminhamento.findFirst.mockResolvedValueOnce(enc({ status: 'aceito' }))
    inAppMock.mockRejectedValueOnce(new Error('sino fora'))
    await avisarEncaminhamento('aceito', 'enc-1')
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('User ID: u-tutor'), expect.any(Error))
    expect(inAppMock).toHaveBeenCalledTimes(2)
    expect(whatsappMock).toHaveBeenCalledTimes(1)
    consoleSpy.mockRestore()
  })

  it('erro geral (banco ou WhatsApp) nunca lança', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    prismaMock.encaminhamento.findFirst.mockRejectedValueOnce(new Error('db fora'))
    await expect(avisarEncaminhamento('novo', 'enc-1')).resolves.toBeUndefined()
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Erro geral ao avisar novo'), expect.any(Error))
    consoleSpy.mockRestore()
  })
})
