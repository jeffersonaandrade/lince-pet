import { beforeEach, describe, expect, it, vi } from 'vitest'
import { conferirNovasEspecialidades } from '@/server/services/especialidades'

const mocks = vi.hoisted(() => {
  const tx = {
    $executeRaw: vi.fn(), $queryRaw: vi.fn(),
    especialidade: { findMany: vi.fn(), findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
  }
  return { tx, prisma: { ...tx, $transaction: vi.fn(async (fn: (t: typeof tx) => unknown) => fn(tx)) } }
})
vi.mock('@/server/db', () => ({ prisma: mocks.prisma }))
import { atualizarEspecialidadeAdmin, criarEspecialidadeAdmin, inativarEspecialidadeAdmin, listarEspecialidadesAdmin } from '@/server/services/admin-especialidades'

const atual = { id: 'esp-1', nome: 'Cardiologia', descricao: null, ativo: 1, createdAt: null, updatedAt: null }
const payload = { nome: 'Cardiologia', descricao: null, ativo: true }
beforeEach(() => {
  vi.clearAllMocks()
  mocks.tx.$queryRaw.mockResolvedValue([])
  mocks.tx.especialidade.findUnique.mockResolvedValue(atual)
  mocks.tx.especialidade.create.mockResolvedValue(atual)
  mocks.tx.especialidade.findMany.mockResolvedValue([{ ...atual, _count: { relacionamentos: 3 } }])
})
const revisaoAtual = async () => (await listarEspecialidadesAdmin())[0].revisao

describe('admin de especialidades', () => {
  it('lista vínculos e inclui revisão do estado completo', async () => {
    const [e] = await listarEspecialidadesAdmin()
    expect(e).toMatchObject({ id: atual.id, ativo: true, vinculos: 3 })
    mocks.tx.especialidade.findMany.mockResolvedValueOnce([{ ...atual, nome: 'Outro nome', _count: { relacionamentos: 3 } }])
    expect((await listarEspecialidadesAdmin())[0].revisao).not.toBe(e.revisao)
  })
  it('normaliza espaços e cria sem aceitar ID fornecido pelo cliente', async () => {
    await criarEspecialidadeAdmin({ ...payload, nome: '  Medicina   Felina  ', id: 'injetado' })
    const data = mocks.tx.especialidade.create.mock.calls[0][0].data
    expect(data.nome).toBe('Medicina Felina')
    expect(data.id).not.toBe('injetado')
    expect(mocks.tx.$executeRaw).toHaveBeenCalledOnce()
  })
  it.each([null, [], {}, { ...payload, nome: ' ' }, { ...payload, nome: 'a'.repeat(256) },
    { ...payload, descricao: 3 }, { ...payload, descricao: 'x'.repeat(2001) }, { ...payload, ativo: 'true' }])('recusa payload inválido %#', async body => {
    await expect(criarEspecialidadeAdmin(body)).rejects.toMatchObject({ status: 422 })
    expect(mocks.tx.especialidade.create).not.toHaveBeenCalled()
  })
  it('recusa duplicação inclusive de registro inativo', async () => {
    mocks.tx.$queryRaw.mockResolvedValueOnce([{ id: 'inativa' }])
    await expect(criarEspecialidadeAdmin(payload)).rejects.toMatchObject({ status: 409 })
    expect(mocks.tx.especialidade.create).not.toHaveBeenCalled()
  })
  it('edita preservando o ID e pode reativar', async () => {
    await atualizarEspecialidadeAdmin(atual.id, { ...payload, revisao: await revisaoAtual() })
    expect(mocks.tx.especialidade.update).toHaveBeenCalledWith({ where: { id: atual.id }, data: expect.objectContaining({ ativo: 1, nome: payload.nome }) })
  })
  it('inativa sem apagar relacionamentos', async () => {
    await inativarEspecialidadeAdmin(atual.id, { revisao: await revisaoAtual() })
    expect(mocks.tx.especialidade.update).toHaveBeenCalledWith({ where: { id: atual.id }, data: expect.objectContaining({ ativo: 0 }) })
  })
  it.each(['editar', 'inativar'])('bloqueia %s com revisão desatualizada', async operacao => {
    const promise = operacao === 'editar' ? atualizarEspecialidadeAdmin(atual.id, { ...payload, revisao: 'antiga' }) : inativarEspecialidadeAdmin(atual.id, { revisao: 'antiga' })
    await expect(promise).rejects.toMatchObject({ status: 409 })
    expect(mocks.tx.especialidade.update).not.toHaveBeenCalled()
  })
  it('retorna 404 para item inexistente', async () => {
    mocks.tx.especialidade.findUnique.mockResolvedValueOnce(null)
    await expect(inativarEspecialidadeAdmin('ausente', {})).rejects.toMatchObject({ status: 404 })
  })
})

describe('novos vínculos', () => {
  it('não consulta opções quando somente preserva vínculos anteriores', async () => {
    await conferirNovasEspecialidades(mocks.tx as never, [])
    expect(mocks.tx.$queryRaw).not.toHaveBeenCalled()
  })
  it('recusa opção inativa ou inexistente', async () => {
    await expect(conferirNovasEspecialidades(mocks.tx as never, ['inativa'])).rejects.toMatchObject({ status: 422 })
  })
  it('aceita novas opções ativas', async () => {
    mocks.tx.$queryRaw.mockResolvedValueOnce([{ id: 'ativa' }])
    await expect(conferirNovasEspecialidades(mocks.tx as never, ['ativa'])).resolves.toBeUndefined()
  })
})
