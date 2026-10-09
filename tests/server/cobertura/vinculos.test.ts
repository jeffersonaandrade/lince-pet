import { beforeEach, describe, expect, it, vi } from 'vitest'
import { HttpError } from '@/server/http'

const prismaMock = vi.hoisted(() => {
  const tx = {
    veterinarioClinica: { updateMany: vi.fn() },
    veterinarioEndereco: { create: vi.fn() },
  }
  return {
    tx,
    veterinario: { findFirst: vi.fn() },
    veterinarioClinica: { findFirst: vi.fn(), deleteMany: vi.fn() },
    clinica: { findUnique: vi.fn() },
    user: { findFirst: vi.fn() },
    $transaction: vi.fn(async (fn: (t: typeof tx) => unknown) => fn(tx)),
  }
})
vi.mock('@/server/db', () => ({ prisma: prismaMock }))

const notificacoes = vi.hoisted(() => ({ notifyClinicLinkResponse: vi.fn() }))
vi.mock('@/server/services/in-app-notifications', () => ({ inAppNotifications: notificacoes }))

const equipe = vi.hoisted(() => ({ garantirVagaNaEquipe: vi.fn() }))
vi.mock('@/server/services/clinica-equipe', () => equipe)

import { aceitarVinculo, recusarVinculo } from '@/server/services/vinculos'

const vetUser = { id: 'u-vet', nome: 'Ana', sobrenome: 'Vet', userType: 'veterinario' } as never
const clinicaCompleta = {
  id: 'cli-1',
  userId: 'u-cli',
  nomeClinica: 'Clínica Boa',
  endereco: 'Rua X',
  cidade: 'Recife',
  estado: 'PE',
  cep: '50000000',
  fotoPerfil: 'https://cdn/foto.jpg',
}

beforeEach(() => {
  vi.clearAllMocks()
  prismaMock.veterinario.findFirst.mockResolvedValue({ id: 'vet-1' })
  prismaMock.veterinarioClinica.findFirst.mockResolvedValue({ id: 'pivot-1', status: 'pendente' })
  prismaMock.clinica.findUnique.mockResolvedValue(clinicaCompleta)
  prismaMock.user.findFirst.mockResolvedValue({ id: 'u-cli' })
  equipe.garantirVagaNaEquipe.mockResolvedValue(undefined)
})

describe('aceitarVinculo', () => {
  it('busca o veterinário pelo userId e devolve 404 (HttpError) quando não existe', async () => {
    prismaMock.veterinario.findFirst.mockResolvedValueOnce(null)
    const erro = await aceitarVinculo(vetUser, 'cli-1').catch((e) => e)
    expect(erro).toBeInstanceOf(HttpError)
    expect(erro).toMatchObject({ status: 404, body: { status: 404, message: 'Row not found' } })
    expect(prismaMock.veterinario.findFirst).toHaveBeenCalledWith({ where: { userId: 'u-vet' } })
  })

  it('sem solicitação pendente devolve false e não consome vaga nem abre transação', async () => {
    prismaMock.veterinarioClinica.findFirst.mockResolvedValueOnce(null)
    await expect(aceitarVinculo(vetUser, 'cli-1')).resolves.toBe(false)
    expect(prismaMock.veterinarioClinica.findFirst).toHaveBeenCalledWith({
      where: { veterinarioId: 'vet-1', clinicaId: 'cli-1', status: 'pendente' },
    })
    expect(equipe.garantirVagaNaEquipe).not.toHaveBeenCalled()
    expect(prismaMock.$transaction).not.toHaveBeenCalled()
  })

  it('clínica inexistente: 404 sem checar vaga', async () => {
    prismaMock.clinica.findUnique.mockResolvedValueOnce(null)
    await expect(aceitarVinculo(vetUser, 'cli-x')).rejects.toMatchObject({ status: 404 })
    expect(equipe.garantirVagaNaEquipe).not.toHaveBeenCalled()
  })

  it('limite de vets do plano da clínica estourado (403): não aceita o vínculo', async () => {
    equipe.garantirVagaNaEquipe.mockRejectedValueOnce(new HttpError(403, { message: 'Limite do plano' }))
    await expect(aceitarVinculo(vetUser, 'cli-1')).rejects.toMatchObject({ status: 403 })
    expect(equipe.garantirVagaNaEquipe).toHaveBeenCalledWith('cli-1', 'vet-1')
    expect(prismaMock.$transaction).not.toHaveBeenCalled()
    expect(prismaMock.tx.veterinarioClinica.updateMany).not.toHaveBeenCalled()
  })

  it('caminho feliz: marca aceito/ativo, cria endereço da clínica e notifica a clínica', async () => {
    await expect(aceitarVinculo(vetUser, 'cli-1')).resolves.toBe(true)

    const update = prismaMock.tx.veterinarioClinica.updateMany.mock.calls[0][0]
    expect(update.where).toEqual({ veterinarioId: 'vet-1', clinicaId: 'cli-1' })
    expect(update.data).toMatchObject({ status: 'aceito', ativo: 1 })
    expect(update.data.updatedAt).toBeInstanceOf(Date)

    const endereco = prismaMock.tx.veterinarioEndereco.create.mock.calls[0][0].data
    expect(endereco).toMatchObject({
      veterinarioId: 'vet-1',
      clinicaId: 'cli-1',
      nomeClinica: 'Clínica Boa',
      rua: 'Rua X',
      numero: 'S/N',
      bairro: '',
      cidade: 'Recife',
      estado: 'PE',
      cep: '50000000',
      precoConsulta: 0,
      horariosDisponibilidade: {},
      aceitaEmergencia: 0,
      ativo: 1,
      isPrimary: 0,
      fotoUrl: 'https://cdn/foto.jpg',
    })
    expect(typeof endereco.id).toBe('string')
    expect(endereco.createdAt).toBeInstanceOf(Date)

    expect(prismaMock.user.findFirst).toHaveBeenCalledWith({ where: { id: 'u-cli' } })
    expect(notificacoes.notifyClinicLinkResponse).toHaveBeenCalledWith({
      clinicaUserId: 'u-cli',
      veterinarioNome: 'Ana Vet',
      aceito: true,
    })
  })

  it('clínica sem endereço/cidade/estado/cep grava strings vazias; sem userId não notifica', async () => {
    prismaMock.clinica.findUnique.mockResolvedValueOnce({
      id: 'cli-2',
      userId: null,
      nomeClinica: 'Sem dados',
      endereco: null,
      cidade: null,
      estado: null,
      cep: null,
      fotoPerfil: null,
    })
    await expect(aceitarVinculo(vetUser, 'cli-2')).resolves.toBe(true)
    expect(prismaMock.tx.veterinarioEndereco.create.mock.calls[0][0].data).toMatchObject({
      rua: '',
      cidade: '',
      estado: '',
      cep: '',
      fotoUrl: null,
    })
    expect(prismaMock.user.findFirst).not.toHaveBeenCalled()
    expect(notificacoes.notifyClinicLinkResponse).not.toHaveBeenCalled()
  })

  it('usuário da clínica não encontrado: aceita sem notificar', async () => {
    prismaMock.user.findFirst.mockResolvedValueOnce(null)
    await expect(aceitarVinculo(vetUser, 'cli-1')).resolves.toBe(true)
    expect(notificacoes.notifyClinicLinkResponse).not.toHaveBeenCalled()
  })

  it('nome do veterinário sem sobrenome não fica com espaço sobrando', async () => {
    const semSobrenome = { id: 'u-vet', nome: 'Ana', sobrenome: null } as never
    await aceitarVinculo(semSobrenome, 'cli-1')
    expect(notificacoes.notifyClinicLinkResponse).toHaveBeenCalledWith(expect.objectContaining({ veterinarioNome: 'Ana' }))
  })
})

describe('recusarVinculo', () => {
  it('sem perfil de veterinário: 404', async () => {
    prismaMock.veterinario.findFirst.mockResolvedValueOnce(null)
    await expect(recusarVinculo(vetUser, 'cli-1')).rejects.toMatchObject({ status: 404 })
    expect(prismaMock.veterinarioClinica.deleteMany).not.toHaveBeenCalled()
  })

  it('sem vínculo em qualquer status devolve false', async () => {
    prismaMock.veterinarioClinica.findFirst.mockResolvedValueOnce(null)
    await expect(recusarVinculo(vetUser, 'cli-1')).resolves.toBe(false)
    expect(prismaMock.veterinarioClinica.findFirst).toHaveBeenCalledWith({
      where: { veterinarioId: 'vet-1', clinicaId: 'cli-1' },
    })
    expect(prismaMock.veterinarioClinica.deleteMany).not.toHaveBeenCalled()
  })

  it('não exige vaga no plano da clínica para recusar', async () => {
    await recusarVinculo(vetUser, 'cli-1')
    expect(equipe.garantirVagaNaEquipe).not.toHaveBeenCalled()
  })

  it('clínica inexistente: 404 sem apagar', async () => {
    prismaMock.clinica.findUnique.mockResolvedValueOnce(null)
    await expect(recusarVinculo(vetUser, 'cli-x')).rejects.toMatchObject({ status: 404 })
    expect(prismaMock.veterinarioClinica.deleteMany).not.toHaveBeenCalled()
  })

  it('apaga o vínculo e notifica a clínica com aceito=false', async () => {
    await expect(recusarVinculo(vetUser, 'cli-1')).resolves.toBe(true)
    expect(prismaMock.veterinarioClinica.deleteMany).toHaveBeenCalledWith({
      where: { veterinarioId: 'vet-1', clinicaId: 'cli-1' },
    })
    expect(notificacoes.notifyClinicLinkResponse).toHaveBeenCalledWith({
      clinicaUserId: 'u-cli',
      veterinarioNome: 'Ana Vet',
      aceito: false,
    })
  })

  it('clínica sem userId: apaga sem buscar usuário nem notificar', async () => {
    prismaMock.clinica.findUnique.mockResolvedValueOnce({ ...clinicaCompleta, userId: null })
    await expect(recusarVinculo(vetUser, 'cli-1')).resolves.toBe(true)
    expect(prismaMock.user.findFirst).not.toHaveBeenCalled()
    expect(notificacoes.notifyClinicLinkResponse).not.toHaveBeenCalled()
  })

  it('usuário da clínica não encontrado: apaga sem notificar', async () => {
    prismaMock.user.findFirst.mockResolvedValueOnce(null)
    await expect(recusarVinculo(vetUser, 'cli-1')).resolves.toBe(true)
    expect(prismaMock.veterinarioClinica.deleteMany).toHaveBeenCalled()
    expect(notificacoes.notifyClinicLinkResponse).not.toHaveBeenCalled()
  })
})
