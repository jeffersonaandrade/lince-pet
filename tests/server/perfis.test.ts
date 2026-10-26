import { beforeEach, describe, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => {
  const m = {
    $executeRaw: vi.fn(), user: { findUnique: vi.fn(), update: vi.fn() },
    tutor: { findFirst: vi.fn(), create: vi.fn() }, veterinario: { findFirst: vi.fn(), create: vi.fn() },
    prestador: { findFirst: vi.fn(), create: vi.fn() }, tipoServico: { findFirst: vi.fn() },
  }
  return { db: Object.assign(m, { $transaction: vi.fn(async (fn: (db: typeof m) => unknown) => fn(m)) }), loadUser: vi.fn(), tokenFor: vi.fn() }
})
vi.mock('@/server/db', () => ({ prisma: mocks.db }))
vi.mock('@/server/auth/session', () => ({ loadUser: mocks.loadUser }))
vi.mock('@/server/services/auth', () => ({ tokenFor: mocks.tokenFor }))
import { ativarPerfil, listarPerfis, selecionarPerfil } from '@/server/services/perfis'
const body = { tipo: 'veterinario', cpf: '52998224725', celular: '11999999999', sobrenome: 'Teste' }
beforeEach(() => {
  vi.clearAllMocks()
  mocks.db.user.findUnique.mockResolvedValue({ id: 'dono', userType: 'tutor' })
  for (const key of ['tutor', 'veterinario', 'prestador'] as const) mocks.db[key].findFirst.mockResolvedValue(null)
  mocks.db.tipoServico.findFirst.mockResolvedValue({ id: 'tipo-1' })
})
describe('perfis individuais', () => {
  it('lista somente perfis da conta autenticada', async () => {
    mocks.db.tutor.findFirst.mockResolvedValue({ id: 'tutor-1' })
    expect(await listarPerfis('dono')).toEqual([{ tipo: 'tutor', ativo: true }, { tipo: 'veterinario', ativo: false }, { tipo: 'prestador', ativo: false }])
  })
  it('ativa veterinário sem criar outro login nem conceder plano ou aprovação', async () => {
    await ativarPerfil('dono', body)
    expect(mocks.db.veterinario.create).toHaveBeenCalledWith({ data: expect.objectContaining({ userId: 'dono', subscriptionPlanCode: 'none', crmvStatus: 'pendente', onboardingComplete: 0 }) })
    expect(mocks.db.user.update.mock.calls[0][0].data).not.toHaveProperty('userType')
  })
  it('não duplica nem zera plano de perfil já existente', async () => {
    mocks.db.veterinario.findFirst.mockResolvedValue({ id: 'vet-antigo', subscriptionPlanCode: 'vet_pro' })
    await ativarPerfil('dono', { tipo: 'veterinario' })
    expect(mocks.db.veterinario.create).not.toHaveBeenCalled()
    expect(mocks.db.user.update).not.toHaveBeenCalled()
  })
  it('cria tutor gratuito sem exigir cadastro profissional', async () => {
    await ativarPerfil('dono', { tipo: 'tutor' })
    expect(mocks.db.tutor.create).toHaveBeenCalledWith({ data: expect.objectContaining({ userId: 'dono' }) })
  })
  it('mantém o plano inicial do prestador separado', async () => {
    await ativarPerfil('dono', { ...body, tipo: 'prestador', tipo_servico: 'passeador' })
    expect(mocks.db.prestador.create).toHaveBeenCalledWith({ data: expect.objectContaining({ subscriptionPlanCode: 'free', tipoServicoId: 'tipo-1' }) })
  })
  it('recusa CPF diferente do outro perfil da mesma pessoa', async () => {
    mocks.db.tutor.findFirst.mockResolvedValue({ id: 'tutor', cpf: '11111111111' })
    await expect(ativarPerfil('dono', body)).rejects.toMatchObject({ status: 422 })
    expect(mocks.db.veterinario.create).not.toHaveBeenCalled()
  })
  it.each(['clinica', 'admin', 'outro'])('não permite ativar %s', async tipo => {
    await expect(ativarPerfil('dono', { tipo })).rejects.toMatchObject({ status: 422 })
  })
  it('conta de clínica não adiciona perfil de tutor', async () => {
    mocks.db.user.findUnique.mockResolvedValue({ id: 'dono', userType: 'clinica' })
    await expect(ativarPerfil('dono', { tipo: 'tutor' })).rejects.toMatchObject({ status: 403 })
  })
  it('não gera token para perfil não ativado', async () => {
    await expect(selecionarPerfil('dono', 'prestador')).rejects.toMatchObject({ status: 403 })
    expect(mocks.tokenFor).not.toHaveBeenCalled()
  })
})
