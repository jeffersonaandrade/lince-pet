import { describe, it, expect, vi, beforeEach } from 'vitest'

const prismaMock = vi.hoisted(() => ({
  veterinario: { findMany: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
  clinica: { findMany: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
}))
vi.mock('@/server/db', () => ({ prisma: prismaMock }))

const sinoMock = vi.hoisted(() => vi.fn())
const emailMock = vi.hoisted(() => vi.fn())
vi.mock('@/server/services/in-app-notifications', () => ({ inAppNotifications: { createGenericNotification: sinoMock } }))
vi.mock('@/server/services/notifications', () => ({ notifications: { sendPedidoServico: emailMock } }))

import {
  decidirCrmv,
  decidirRt,
  listarPendentes,
  resolverDecisao,
  salvarRt,
  statusAposTroca,
  ufDoCrmv,
} from '@/server/services/aprovacoes'
import { avisarUsuario } from '@/server/services/aviso-usuario'

const user = { id: 'u1', nome: 'Ana', sobrenome: 'Lima', email: 'ana@x.com', notificarEmail: 1 }
const data = new Date('2026-10-20T10:00:00Z')

beforeEach(() => {
  vi.clearAllMocks()
  sinoMock.mockResolvedValue(undefined)
  emailMock.mockResolvedValue({ success: true })
})

describe('regras puras', () => {
  it('reprovar exige motivo; aprovar limpa o motivo', () => {
    expect(resolverDecisao({ decisao: 'aprovar', motivo: 'x' })).toEqual({ status: 'aprovado', motivo: null })
    expect(resolverDecisao({ decisao: 'reprovar', motivo: ' CRMV inexistente ' })).toEqual({ status: 'reprovado', motivo: 'CRMV inexistente' })
    expect(() => resolverDecisao({ decisao: 'reprovar', motivo: '  ' })).toThrow(/motivo/)
  })

  it('UF do CRMV', () => {
    expect(ufDoCrmv('12345-SP')).toBe('SP')
    expect(ufDoCrmv('12345')).toBeNull()
    expect(ufDoCrmv(null)).toBeNull()
  })

  it('mesmo CRMV mantém a análise; número novo ou reenvio de reprovado volta para pendente', () => {
    expect(statusAposTroca('1-SP', '1-SP', 'aprovado')).toBe('aprovado')
    expect(statusAposTroca('1-SP', '2-SP', 'aprovado')).toBe('pendente')
    expect(statusAposTroca('1-SP', '1-SP', 'reprovado')).toBe('pendente')
    expect(statusAposTroca(null, '1-SP', null)).toBe('pendente')
  })
})

describe('listarPendentes', () => {
  it('vets com CRMV pendente e clínicas com RT pendente, mais antigos primeiro', async () => {
    prismaMock.veterinario.findMany.mockResolvedValue([
      { id: 'v1', crmv: '123-SP', crmvEnviadoEm: data, user },
      { id: 'v2', crmv: '9', crmvEnviadoEm: null, updatedAt: null, createdAt: null, user: null },
    ])
    prismaMock.clinica.findMany.mockResolvedValue([
      { id: 'c1', nomeClinica: 'Centro', cnpj: '1', cidade: 'SP', estado: 'SP', rtNome: 'Dra. Ana', rtCrmv: '55-RJ', rtEnviadoEm: null, updatedAt: data, user },
      { id: 'c2', nomeClinica: null, rtEnviadoEm: null, updatedAt: null, user: null },
    ])

    const r = await listarPendentes()
    expect(prismaMock.veterinario.findMany.mock.calls[0][0].where).toEqual({ crmvStatus: 'pendente', crmv: { not: null } })
    expect(prismaMock.clinica.findMany.mock.calls[0][0].where).toEqual({ rtStatus: 'pendente' })
    expect(r.veterinarios[0]).toMatchObject({ id: 'v1', nome: 'Ana Lima', email: 'ana@x.com', uf: 'SP', enviado_em: data.toISOString() })
    expect(r.veterinarios[1]).toMatchObject({ nome: 'Veterinário', email: null, uf: null, enviado_em: null })
    expect(r.clinicas[0]).toMatchObject({ nome: 'Centro', rt_nome: 'Dra. Ana', uf: 'RJ', enviado_em: data.toISOString() })
    expect(r.clinicas[1]).toMatchObject({ nome: 'Clínica', email: null, enviado_em: null })
  })
})

describe('decidirCrmv', () => {
  it('aprovar libera o vet e avisa', async () => {
    prismaMock.veterinario.findUnique.mockResolvedValue({ id: 'v1', crmv: '1-SP', crmvStatus: 'pendente', user })
    expect(await decidirCrmv('v1', { decisao: 'aprovar' })).toEqual({ id: 'v1', status: 'aprovado', motivo: null })
    expect(prismaMock.veterinario.update.mock.calls[0][0].data).toMatchObject({ crmvStatus: 'aprovado', crmvMotivo: null })
    expect(sinoMock).toHaveBeenCalledWith(expect.objectContaining({ userId: 'u1', type: 'CRMV_APROVADO' }))
  })

  it('reprovar grava e avisa o motivo', async () => {
    prismaMock.veterinario.findUnique.mockResolvedValue({ id: 'v1', crmv: '1-SP', crmvStatus: 'pendente', user })
    await decidirCrmv('v1', { decisao: 'reprovar', motivo: 'Não consta no CFMV' })
    expect(sinoMock).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'CRMV_REPROVADO', message: expect.stringContaining('Motivo: Não consta no CFMV') })
    )
    expect(emailMock).toHaveBeenCalledWith('ana@x.com', 'CRMV reprovado', expect.anything())
  })

  it('não encontrado: 404; fora de análise: 409; vet sem usuário não avisa', async () => {
    prismaMock.veterinario.findUnique.mockResolvedValueOnce(null)
    await expect(decidirCrmv('v1', { decisao: 'aprovar' })).rejects.toMatchObject({ status: 404 })
    prismaMock.veterinario.findUnique.mockResolvedValueOnce({ id: 'v1', crmvStatus: 'aprovado' })
    await expect(decidirCrmv('v1', { decisao: 'aprovar' })).rejects.toMatchObject({ status: 409 })
    prismaMock.veterinario.findUnique.mockResolvedValueOnce({ id: 'v1', crmvStatus: 'pendente', user: null })
    await decidirCrmv('v1', { decisao: 'aprovar' })
    expect(sinoMock).not.toHaveBeenCalled()
  })
})

describe('decidirRt', () => {
  it('aprovar libera os exames da clínica e avisa', async () => {
    prismaMock.clinica.findUnique.mockResolvedValue({ id: 'c1', rtStatus: 'pendente', rtNome: 'Dra', rtCrmv: '1-SP', user })
    await decidirRt('c1', { decisao: 'aprovar' })
    expect(prismaMock.clinica.update.mock.calls[0][0].data).toMatchObject({ rtStatus: 'aprovado', rtMotivo: null })
    expect(sinoMock).toHaveBeenCalledWith(expect.objectContaining({ type: 'RT_APROVADO' }))
  })

  it('reprovar com motivo', async () => {
    prismaMock.clinica.findUnique.mockResolvedValue({ id: 'c1', rtStatus: 'pendente', user })
    await decidirRt('c1', { decisao: 'reprovar', motivo: 'CRMV de outra pessoa' })
    expect(sinoMock).toHaveBeenCalledWith(expect.objectContaining({ type: 'RT_REPROVADO', message: expect.stringContaining('CRMV de outra pessoa') }))
  })

  it('não encontrada: 404; fora de análise: 409; sem usuário não avisa', async () => {
    prismaMock.clinica.findUnique.mockResolvedValueOnce(null)
    await expect(decidirRt('c1', { decisao: 'aprovar' })).rejects.toMatchObject({ status: 404 })
    prismaMock.clinica.findUnique.mockResolvedValueOnce({ id: 'c1', rtStatus: null })
    await expect(decidirRt('c1', { decisao: 'aprovar' })).rejects.toMatchObject({ status: 409 })
    prismaMock.clinica.findUnique.mockResolvedValueOnce({ id: 'c1', rtStatus: 'pendente', user: null })
    await decidirRt('c1', { decisao: 'aprovar' })
    expect(sinoMock).not.toHaveBeenCalled()
  })
})

describe('salvarRt', () => {
  const rtAtual = { id: 'c1', rtNome: 'Dra. Ana', rtCrmv: '123-SP', rtStatus: 'aprovado', rtMotivo: null }

  it('RT novo volta para pendente e normaliza o CRMV', async () => {
    prismaMock.clinica.findUnique.mockResolvedValue(rtAtual)
    prismaMock.clinica.update.mockImplementation(async ({ data }) => ({ ...rtAtual, ...data }))
    const r = await salvarRt('c1', { rt_nome: 'Dr. Bruno', rt_crmv: '999-rj' })
    expect(r).toEqual({ rt_nome: 'Dr. Bruno', rt_crmv: '999-RJ', rt_status: 'pendente', rt_motivo: null })
    expect(prismaMock.clinica.update.mock.calls[0][0].data.rtEnviadoEm).toBeInstanceOf(Date)
  })

  it('mesmo RT mantém a aprovação', async () => {
    prismaMock.clinica.findUnique.mockResolvedValue(rtAtual)
    prismaMock.clinica.update.mockImplementation(async ({ data }) => ({ ...rtAtual, ...data }))
    expect((await salvarRt('c1', { rt_nome: 'Dra. Ana', rt_crmv: '123-SP' })).rt_status).toBe('aprovado')
    expect(prismaMock.clinica.update.mock.calls[0][0].data.rtStatus).toBeUndefined()
  })

  it('CRMV fora do formato: 422; clínica inexistente: 404', async () => {
    await expect(salvarRt('c1', { rt_nome: 'Dra. Ana', rt_crmv: '123' })).rejects.toMatchObject({ status: 422 })
    prismaMock.clinica.findUnique.mockResolvedValue(null)
    await expect(salvarRt('c1', { rt_nome: 'Dra. Ana', rt_crmv: '123-SP' })).rejects.toMatchObject({ status: 404 })
  })
})

describe('avisarUsuario', () => {
  it('sino sempre; e-mail só com opt-in; nunca lança', async () => {
    await avisarUsuario({ ...user, notificarEmail: 0 }, { tipo: 'X', titulo: 'T', mensagem: 'M' })
    expect(sinoMock).toHaveBeenCalledWith({ userId: 'u1', type: 'X', title: 'T', message: 'M', actionData: null })
    expect(emailMock).not.toHaveBeenCalled()

    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    sinoMock.mockRejectedValueOnce(new Error('db down'))
    await expect(avisarUsuario(user, { tipo: 'X', titulo: 'T', mensagem: 'M' })).resolves.toBeUndefined()
    expect(log).toHaveBeenCalled()
    log.mockRestore()
  })
})
