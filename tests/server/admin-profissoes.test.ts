import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => {
  const tx = {
    $executeRaw: vi.fn(), $queryRaw: vi.fn(), prestador: { count: vi.fn() },
    tipoServico: { findMany: vi.fn(), findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
  }
  return { tx, prisma: { ...tx, $transaction: vi.fn(async (fn: (t: typeof tx) => unknown) => fn(tx)) } }
})
vi.mock('@/server/db', () => ({ prisma: mocks.prisma }))
import { atualizarProfissaoAdmin, criarProfissaoAdmin, inativarProfissaoAdmin, listarProfissoesAdmin } from '@/server/services/admin-profissoes'

const atual = { id: 'esp-1', slug: 'cardio', modalidade: 'duracao', ordem: 1, nome: 'Cardiologia', descricao: null, ativo: 1, createdAt: null, updatedAt: null }
const payload = { slug: 'cardio', modalidade: 'duracao', ordem: 1, nome: 'Cardiologia', descricao: null, ativo: true }
beforeEach(() => {
  vi.clearAllMocks()
  mocks.tx.$queryRaw.mockResolvedValue([])
  mocks.tx.tipoServico.findUnique.mockImplementation(async (args: { where: { id?: string } }) => args.where.id ? atual : null)
  mocks.tx.prestador.count.mockResolvedValue(0)
  mocks.tx.tipoServico.create.mockResolvedValue(atual)
  mocks.tx.tipoServico.findMany.mockResolvedValue([{ ...atual, _count: { prestadores: 3 } }])
})
const revisaoAtual = async () => (await listarProfissoesAdmin())[0].revisao

describe('admin de profissoes', () => {
  it('lista vínculos e inclui revisão do estado completo', async () => {
    const [e] = await listarProfissoesAdmin()
    expect(e).toMatchObject({ id: atual.id, ativo: true, vinculos: 3 })
    mocks.tx.tipoServico.findMany.mockResolvedValueOnce([{ ...atual, nome: 'Outro nome', _count: { prestadores: 3 } }])
    expect((await listarProfissoesAdmin())[0].revisao).not.toBe(e.revisao)
  })
  it('normaliza espaços e cria sem aceitar ID fornecido pelo cliente', async () => {
    await criarProfissaoAdmin({ ...payload, nome: '  Medicina   Felina  ', id: 'injetado' })
    const data = mocks.tx.tipoServico.create.mock.calls[0][0].data
    expect(data.nome).toBe('Medicina Felina')
    expect(data.id).not.toBe('injetado')
    expect(mocks.tx.$executeRaw).toHaveBeenCalledOnce()
  })
  it.each([null, [], {}, { ...payload, nome: ' ' }, { ...payload, nome: 'a'.repeat(101) },
    { ...payload, descricao: 3 }, { ...payload, descricao: 'x'.repeat(256) }, { ...payload, ativo: 'true' }])('recusa payload inválido %#', async body => {
    await expect(criarProfissaoAdmin(body)).rejects.toMatchObject({ status: 422 })
    expect(mocks.tx.tipoServico.create).not.toHaveBeenCalled()
  })
  it('recusa duplicação inclusive de registro inativo', async () => {
    mocks.tx.$queryRaw.mockResolvedValueOnce([{ id: 'inativa' }])
    await expect(criarProfissaoAdmin(payload)).rejects.toMatchObject({ status: 409 })
    expect(mocks.tx.tipoServico.create).not.toHaveBeenCalled()
  })
  it('edita preservando o ID e pode reativar', async () => {
    await atualizarProfissaoAdmin(atual.id, { ...payload, revisao: await revisaoAtual() })
    expect(mocks.tx.tipoServico.update).toHaveBeenCalledWith({ where: { id: atual.id }, data: expect.objectContaining({ ativo: 1, nome: payload.nome }) })
  })
  it('inativa sem apagar prestadores', async () => {
    await inativarProfissaoAdmin(atual.id, { revisao: await revisaoAtual() })
    expect(mocks.tx.tipoServico.update).toHaveBeenCalledWith({ where: { id: atual.id }, data: expect.objectContaining({ ativo: 0 }) })
  })
  it.each(['editar', 'inativar'])('bloqueia %s com revisão desatualizada', async operacao => {
    const promise = operacao === 'editar' ? atualizarProfissaoAdmin(atual.id, { ...payload, revisao: 'antiga' }) : inativarProfissaoAdmin(atual.id, { revisao: 'antiga' })
    await expect(promise).rejects.toMatchObject({ status: 409 })
    expect(mocks.tx.tipoServico.update).not.toHaveBeenCalled()
  })
  it('retorna 404 para item inexistente', async () => {
    mocks.tx.tipoServico.findUnique.mockResolvedValueOnce(null)
    await expect(inativarProfissaoAdmin('ausente', {})).rejects.toMatchObject({ status: 404 })
  })
})


it('modalidade com profissionais vinculados não pode mudar', async () => {
  mocks.tx.prestador.count.mockResolvedValue(1)
  await expect(atualizarProfissaoAdmin(atual.id, { ...payload, modalidade: 'periodo', revisao: await revisaoAtual() })).rejects.toMatchObject({ status: 409 })
  expect(mocks.tx.tipoServico.update).not.toHaveBeenCalled()
})
it('slug continua estável mesmo sem vínculos', async () => {
  await expect(atualizarProfissaoAdmin(atual.id, { ...payload, slug: 'outro', revisao: await revisaoAtual() })).rejects.toMatchObject({ status: 422 })
})
it('slug duplicado é rejeitado', async () => {
  mocks.tx.tipoServico.findUnique.mockResolvedValueOnce(atual)
  await expect(criarProfissaoAdmin(payload)).rejects.toMatchObject({ status: 409 })
})
it.each([{ slug: 'A B' }, { modalidade: 'outra' }, { ordem: -1 }, { ordem: 1.5 }, { ordem: 10000 }])('valida modalidade, ordem e identificador %#', async extra => {
  await expect(criarProfissaoAdmin({ ...payload, ...extra })).rejects.toMatchObject({ status: 422 })
})
