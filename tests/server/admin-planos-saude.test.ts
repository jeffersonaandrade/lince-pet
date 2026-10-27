import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => {
  const tx = {
    $executeRaw: vi.fn(), $queryRaw: vi.fn(),
    plano: { findMany: vi.fn(), findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
  }
  return { tx, prisma: { ...tx, $transaction: vi.fn(async (fn: (t: typeof tx) => unknown) => fn(tx)) } }
})
vi.mock('@/server/db', () => ({ prisma: mocks.prisma }))
import { atualizarPlanoSaudeAdmin, criarPlanoSaudeAdmin, inativarPlanoSaudeAdmin, listarPlanosSaudeAdmin } from '@/server/services/admin-planos-saude'

const atual = { id: 'esp-1', name: 'Plano Pet', descricao: null, ativo: 1, createdAt: null, updatedAt: null }
const payload = { nome: 'Cardiologia', descricao: null, ativo: true }
beforeEach(() => {
  vi.clearAllMocks()
  mocks.tx.$queryRaw.mockResolvedValue([])
  mocks.tx.plano.findUnique.mockResolvedValue(atual)
  mocks.tx.plano.create.mockResolvedValue(atual)
  mocks.tx.plano.findMany.mockResolvedValue([{ ...atual, _count: { veterinarioPlanos: 2, clinicaPlanos: 1 } }])
})
const revisaoAtual = async () => (await listarPlanosSaudeAdmin())[0].revisao

describe('admin de planos-saude', () => {
  it('lista vínculos e inclui revisão do estado completo', async () => {
    const [e] = await listarPlanosSaudeAdmin()
    expect(e).toMatchObject({ id: atual.id, ativo: true, vinculos: 3 })
    mocks.tx.plano.findMany.mockResolvedValueOnce([{ ...atual, name: 'Outro nome', _count: { veterinarioPlanos: 2, clinicaPlanos: 1 } }])
    expect((await listarPlanosSaudeAdmin())[0].revisao).not.toBe(e.revisao)
  })
  it('normaliza espaços e cria sem aceitar ID fornecido pelo cliente', async () => {
    await criarPlanoSaudeAdmin({ ...payload, nome: '  Medicina   Felina  ', id: 'injetado' })
    const data = mocks.tx.plano.create.mock.calls[0][0].data
    expect(data.name).toBe('Medicina Felina')
    expect(data.id).not.toBe('injetado')
    expect(mocks.tx.$executeRaw).toHaveBeenCalledOnce()
  })
  it.each([null, [], {}, { ...payload, nome: ' ' }, { ...payload, nome: 'a'.repeat(256) },
    { ...payload, descricao: 3 }, { ...payload, descricao: 'x'.repeat(501) }, { ...payload, ativo: 'true' }])('recusa payload inválido %#', async body => {
    await expect(criarPlanoSaudeAdmin(body)).rejects.toMatchObject({ status: 422 })
    expect(mocks.tx.plano.create).not.toHaveBeenCalled()
  })
  it('recusa duplicação inclusive de registro inativo', async () => {
    mocks.tx.$queryRaw.mockResolvedValueOnce([{ id: 'inativa' }])
    await expect(criarPlanoSaudeAdmin(payload)).rejects.toMatchObject({ status: 409 })
    expect(mocks.tx.plano.create).not.toHaveBeenCalled()
  })
  it('edita preservando o ID e pode reativar', async () => {
    await atualizarPlanoSaudeAdmin(atual.id, { ...payload, revisao: await revisaoAtual() })
    expect(mocks.tx.plano.update).toHaveBeenCalledWith({ where: { id: atual.id }, data: expect.objectContaining({ ativo: 1, name: payload.nome }) })
  })
  it('inativa sem apagar relacionamentos', async () => {
    await inativarPlanoSaudeAdmin(atual.id, { revisao: await revisaoAtual() })
    expect(mocks.tx.plano.update).toHaveBeenCalledWith({ where: { id: atual.id }, data: expect.objectContaining({ ativo: 0 }) })
  })
  it.each(['editar', 'inativar'])('bloqueia %s com revisão desatualizada', async operacao => {
    const promise = operacao === 'editar' ? atualizarPlanoSaudeAdmin(atual.id, { ...payload, revisao: 'antiga' }) : inativarPlanoSaudeAdmin(atual.id, { revisao: 'antiga' })
    await expect(promise).rejects.toMatchObject({ status: 409 })
    expect(mocks.tx.plano.update).not.toHaveBeenCalled()
  })
  it('retorna 404 para item inexistente', async () => {
    mocks.tx.plano.findUnique.mockResolvedValueOnce(null)
    await expect(inativarPlanoSaudeAdmin('ausente', {})).rejects.toMatchObject({ status: 404 })
  })
})
