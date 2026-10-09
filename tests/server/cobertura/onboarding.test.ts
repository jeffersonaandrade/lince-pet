import { describe, it, expect, vi, beforeEach } from 'vitest'

const mocks = vi.hoisted(() => {
  const prisma = {
    veterinario: { findFirst: vi.fn() },
    veterinarioEndereco: { deleteMany: vi.fn(), create: vi.fn() },
    experienciaVeterinario: { deleteMany: vi.fn(), create: vi.fn() },
    $transaction: vi.fn(),
  }
  prisma.$transaction.mockImplementation(async (fn: (tx: typeof prisma) => unknown) => fn(prisma))
  return {
    prisma,
    vets: {
      findVeterinarios: vi.fn(),
      saveVeterinario: vi.fn(),
      serializeVeterinario: vi.fn((v: { id: string }) => ({ serializado: v.id })),
      syncEspecialidadesVeterinario: vi.fn(),
      syncPlanosVeterinario: vi.fn(),
      toDateColumn: vi.fn((v: unknown) => (v ? new Date(String(v)) : null)),
    },
  }
})

vi.mock('@/server/db', () => ({ prisma: mocks.prisma }))
vi.mock('@/server/services/veterinarios', () => mocks.vets)

import { HttpError } from '@/server/http'
import {
  validatePreviousSteps,
  processStep1,
  processStep2,
  processStep3,
  processStep4,
  processStep5,
  processStep6,
  processStep7,
  completeOnboarding,
  getProgress,
} from '@/server/services/onboarding'

const { prisma, vets } = mocks

type VetFake = Record<string, unknown>
const vetCompleto = (extra: VetFake = {}): VetFake => ({
  id: 'vet-1',
  crmv: 'PE-123',
  genero: 'feminino',
  atendePresencial: 1,
  atendeOnline: 0,
  bio: 'Sobre mim',
  onboardingStep: 1,
  precoConsultaOnline: 80,
  ...extra,
})
const userCom = (vet: VetFake) => ({ id: 'user-1', veterinario: vet }) as never

const local = (extra: Record<string, unknown> = {}) => ({
  rua: 'Rua A',
  numero: '10',
  cidade: 'Recife',
  estado: 'PE',
  cep: '50000000',
  precoConsulta: 150,
  horariosDisponibilidade: { segunda: ['09:00'] },
  ...extra,
})

beforeEach(() => vi.clearAllMocks())

describe('validatePreviousSteps', () => {
  it('passo 1 não exige nada', () => {
    expect(validatePreviousSteps({} as never, 1)).toEqual([])
  })

  it('acumula as exigências de cada passo anterior', () => {
    expect(validatePreviousSteps({} as never, 2)).toEqual(['CRMV é obrigatório'])
    expect(validatePreviousSteps({} as never, 3)).toEqual(['CRMV é obrigatório', 'Gênero é obrigatório'])
    expect(validatePreviousSteps({ atendePresencial: 0, atendeOnline: 0 } as never, 5)).toEqual([
      'CRMV é obrigatório',
      'Gênero é obrigatório',
      'Selecione pelo menos um tipo de visita',
    ])
    expect(validatePreviousSteps({ atendePresencial: 0, atendeOnline: 0 } as never, 8)).toEqual([
      'CRMV é obrigatório',
      'Gênero é obrigatório',
      'Selecione pelo menos um tipo de visita',
      'Descrição sobre você é obrigatória',
    ])
  })

  it('atendimento só online já satisfaz o tipo de visita', () => {
    expect(validatePreviousSteps(vetCompleto({ atendePresencial: 0, atendeOnline: 1 }) as never, 8)).toEqual([])
  })
})

describe('processStep1 (CRMV)', () => {
  it('rejeita CRMV usado por outro veterinário', async () => {
    prisma.veterinario.findFirst.mockResolvedValueOnce({ id: 'vet-2' })
    const res = await processStep1(userCom(vetCompleto()), { crmv: 'PE-123' } as never)
    expect(res).toEqual({ success: false, errors: ['CRMV já está em uso'], field: 'crmv' })
    expect(prisma.veterinario.findFirst).toHaveBeenCalledWith({
      where: { crmv: 'PE-123', NOT: { id: 'vet-1' } },
      select: { id: true },
    })
    expect(vets.saveVeterinario).not.toHaveBeenCalled()
  })

  it('grava o CRMV e avança para o passo 2', async () => {
    prisma.veterinario.findFirst.mockResolvedValueOnce(null)
    const vet = vetCompleto({ onboardingStep: null })
    const res = await processStep1(userCom(vet), { crmv: 'PE-999' } as never)
    expect(res).toEqual({ success: true, currentStep: 2, veterinarioId: 'vet-1' })
    expect(vets.saveVeterinario).toHaveBeenCalledWith(vet, { crmv: 'PE-999', onboardingStep: 2 })
  })

  it('não retrocede o passo de quem já está mais adiante', async () => {
    prisma.veterinario.findFirst.mockResolvedValueOnce(null)
    const res = await processStep1(userCom(vetCompleto({ onboardingStep: 6 })), { crmv: 'X' } as never)
    expect(res.currentStep).toBe(6)
  })
})

describe('processStep2 (gênero)', () => {
  it('exige CRMV antes', async () => {
    const res = await processStep2(userCom({ id: 'vet-1' }), { genero: 'Feminino' } as never)
    expect(res).toEqual({ success: false, errors: ['CRMV é obrigatório'] })
    expect(vets.saveVeterinario).not.toHaveBeenCalled()
  })

  it.each([
    ['Masculino', 'masculino'],
    ['Feminino', 'feminino'],
    ['Outro', 'outro'],
  ])('mapeia %s para o enum %s', async (entrada, enumValor) => {
    const vet = vetCompleto({ onboardingStep: 2 })
    const res = await processStep2(userCom(vet), { genero: entrada } as never)
    expect(res).toEqual({ success: true, currentStep: 3 })
    expect(vets.saveVeterinario).toHaveBeenCalledWith(vet, { genero: enumValor, onboardingStep: 3 })
  })
})

describe('processStep3 (especialidades)', () => {
  it('exige gênero antes', async () => {
    const res = await processStep3(userCom({ id: 'vet-1', crmv: 'X' }), { especialidades: ['e1'] } as never)
    expect(res).toEqual({ success: false, errors: ['Gênero é obrigatório'] })
    expect(vets.syncEspecialidadesVeterinario).not.toHaveBeenCalled()
  })

  it('sincroniza as especialidades e avança para o passo 4', async () => {
    const vet = vetCompleto({ onboardingStep: 3 })
    const res = await processStep3(userCom(vet), { especialidades: ['e1', 'e2'] } as never)
    expect(res).toEqual({ success: true, currentStep: 4 })
    expect(vets.syncEspecialidadesVeterinario).toHaveBeenCalledWith('vet-1', ['e1', 'e2'])
    expect(vets.saveVeterinario).toHaveBeenCalledWith(vet, { onboardingStep: 4 })
  })
})

describe('processStep4 (tipos de visita e locais)', () => {
  it('exige os passos anteriores', async () => {
    const res = await processStep4(userCom({ id: 'vet-1' }), { visitTypes: { presencial: true, online: false } } as never)
    expect(res.success).toBe(false)
    expect(res.errors).toEqual(['CRMV é obrigatório', 'Gênero é obrigatório'])
  })

  it('sem nenhum tipo de visita: erro', async () => {
    const res = await processStep4(userCom(vetCompleto()), { visitTypes: { presencial: false, online: false } } as never)
    expect(res).toEqual({ success: false, errors: ['Selecione pelo menos um tipo de visita (presencial ou online)'] })
    expect(prisma.$transaction).not.toHaveBeenCalled()
  })

  it('presencial sem endereço: erro', async () => {
    const res = await processStep4(userCom(vetCompleto()), { visitTypes: { presencial: true, online: false } } as never)
    expect(res.errors).toEqual(['Para atendimento presencial, é necessário cadastrar pelo menos um endereço'])
    const vazio = await processStep4(userCom(vetCompleto()), { visitTypes: { presencial: true, online: false }, locations: [] } as never)
    expect(vazio.errors).toEqual(['Para atendimento presencial, é necessário cadastrar pelo menos um endereço'])
  })

  it('valida preço e horários de cada local', async () => {
    const res = await processStep4(userCom(vetCompleto()), {
      visitTypes: { presencial: true, online: false },
      locations: [
        local({ precoConsulta: undefined, horariosDisponibilidade: undefined }),
        local({ precoConsulta: null, horariosDisponibilidade: { segunda: [], terca: 'x' } }),
        local({ precoConsulta: 0 }),
      ],
    } as never)
    expect(res.errors).toEqual([
      'Informe um valor de consulta válido para o local #1',
      'Defina pelo menos um horário de disponibilidade para o local #1',
      'Informe um valor de consulta válido para o local #2',
      'Defina pelo menos um horário de disponibilidade para o local #2',
      'Informe um valor de consulta válido para o local #3',
    ])
  })

  it('online exige valor da consulta online positivo', async () => {
    const semValor = await processStep4(userCom(vetCompleto()), { visitTypes: { presencial: false, online: true } } as never)
    expect(semValor.errors).toEqual(['Informe o valor da consulta online'])
    const zero = await processStep4(userCom(vetCompleto()), {
      visitTypes: { presencial: false, online: true },
      precoConsultaOnline: 0,
    } as never)
    expect(zero.errors).toEqual(['Informe o valor da consulta online'])
  })

  it('presencial: grava flags, recria endereços na transação e arredonda preços', async () => {
    const vet = vetCompleto({ onboardingStep: 4 })
    const res = await processStep4(userCom(vet), {
      visitTypes: { presencial: true, online: true },
      precoConsultaOnline: '99.999',
      locations: [
        local({ precoConsulta: '120.456', bairro: 'Boa Vista', complemento: 'Sala 2', aceitaEmergencia: true, observacoes: 'obs', fotoUrl: 'f.jpg' }),
        local({ isPrimary: true }),
        local(),
      ],
    } as never)

    expect(res).toEqual({ success: true, currentStep: 5 })
    expect(prisma.$transaction).toHaveBeenCalledTimes(1)
    expect(vets.saveVeterinario).toHaveBeenCalledWith(
      vet,
      { atendePresencial: 1, atendeOnline: 1, precoConsultaOnline: 100, onboardingStep: 5 },
      prisma
    )
    expect(prisma.veterinarioEndereco.deleteMany).toHaveBeenCalledWith({ where: { veterinarioId: 'vet-1' } })
    const criados = prisma.veterinarioEndereco.create.mock.calls.map((c) => c[0].data)
    expect(criados).toHaveLength(3)
    expect(criados[0]).toMatchObject({
      veterinarioId: 'vet-1',
      bairro: 'Boa Vista',
      complemento: 'Sala 2',
      aceitaEmergencia: 1,
      observacoes: 'obs',
      isPrimary: 1,
      precoConsulta: 120.46,
      fotoUrl: 'f.jpg',
      ativo: 1,
      horariosDisponibilidade: { segunda: ['09:00'] },
      id: expect.any(String),
    })
    expect(criados[1]).toMatchObject({ bairro: null, complemento: null, aceitaEmergencia: 0, observacoes: null, isPrimary: 1, fotoUrl: null })
    expect(criados[2].isPrimary).toBe(0)
  })

  it('só online: apaga endereços antigos, ignora locais enviados e não retrocede o passo', async () => {
    const vet = vetCompleto({ onboardingStep: 7, precoConsultaOnline: 80 })
    const ok = await processStep4(userCom(vet), {
      visitTypes: { presencial: false, online: true },
      precoConsultaOnline: 50,
      locations: [local()],
    } as never)
    expect(ok).toEqual({ success: true, currentStep: 7 })
    expect(vets.saveVeterinario.mock.calls[0][1]).toMatchObject({ atendePresencial: 0, atendeOnline: 1, precoConsultaOnline: 50 })
    expect(prisma.veterinarioEndereco.deleteMany).toHaveBeenCalled()
    expect(prisma.veterinarioEndereco.create).not.toHaveBeenCalled()
  })

  it('presencial sem preço online mantém o precoConsultaOnline já salvo', async () => {
    const vet = vetCompleto({ precoConsultaOnline: 75 })
    await processStep4(userCom(vet), { visitTypes: { presencial: true, online: false }, locations: [local()] } as never)
    expect(vets.saveVeterinario.mock.calls[0][1].precoConsultaOnline).toBe(75)
  })
})

describe('processStep5 (experiência)', () => {
  it('exige tipo de visita', async () => {
    const res = await processStep5(userCom(vetCompleto({ atendePresencial: 0, atendeOnline: 0 })), { experiencias: [] } as never)
    expect(res).toEqual({ success: false, errors: ['Selecione pelo menos um tipo de visita'] })
  })

  it('recria as experiências na transação (ativo padrão = 1)', async () => {
    const vet = vetCompleto({ onboardingStep: 5 })
    const res = await processStep5(userCom(vet), {
      experiencias: [
        { local: 'Hosp', cargo: 'Vet', dataInicio: '2020-01-01', dataFim: null, descricao: 'd' },
        { local: 'Clin', cargo: 'Aux', dataInicio: '2018-01-01', dataFim: '2019-01-01', descricao: null, ativo: false },
      ],
    } as never)
    expect(res).toEqual({ success: true, currentStep: 6 })
    expect(prisma.experienciaVeterinario.deleteMany).toHaveBeenCalledWith({ where: { veterinarioId: 'vet-1' } })
    const criados = prisma.experienciaVeterinario.create.mock.calls.map((c) => c[0].data)
    expect(criados[0]).toMatchObject({ veterinarioId: 'vet-1', local: 'Hosp', cargo: 'Vet', ativo: 1, dataFim: null })
    expect(criados[0].dataInicio).toEqual(new Date('2020-01-01'))
    expect(criados[1]).toMatchObject({ ativo: 0 })
    expect(vets.saveVeterinario).toHaveBeenCalledWith(vet, { onboardingStep: 6 }, prisma)
  })

  it('sem experiências: só limpa as antigas e avança', async () => {
    const res = await processStep5(userCom(vetCompleto()), {} as never)
    expect(res.success).toBe(true)
    expect(prisma.experienciaVeterinario.deleteMany).toHaveBeenCalled()
    expect(prisma.experienciaVeterinario.create).not.toHaveBeenCalled()
  })
})

describe('processStep6 (planos de saúde)', () => {
  it('exige passos anteriores', async () => {
    const res = await processStep6(userCom({ id: 'vet-1' }), { planos: ['p1'] } as never)
    expect(res.success).toBe(false)
    expect(vets.syncPlanosVeterinario).not.toHaveBeenCalled()
  })

  it('sincroniza planos e avança para o passo 7', async () => {
    const res = await processStep6(userCom(vetCompleto()), { planos: ['p1'] } as never)
    expect(res).toEqual({ success: true, currentStep: 7 })
    expect(vets.syncPlanosVeterinario).toHaveBeenCalledWith('vet-1', ['p1'])
  })

  it('sem planos não sincroniza, mas avança', async () => {
    const res = await processStep6(userCom(vetCompleto()), {} as never)
    expect(res.success).toBe(true)
    expect(vets.syncPlanosVeterinario).not.toHaveBeenCalled()
  })
})

describe('processStep7 (bio)', () => {
  it('exige passos anteriores', async () => {
    const res = await processStep7(userCom({ id: 'vet-1' }), { about: 'x' } as never)
    expect(res.success).toBe(false)
  })

  it('grava a bio e avança para o passo 8', async () => {
    const vet = vetCompleto({ bio: null })
    const res = await processStep7(userCom(vet), { about: 'Minha bio' } as never)
    expect(res).toEqual({ success: true, currentStep: 8 })
    expect(vets.saveVeterinario).toHaveBeenCalledWith(vet, { bio: 'Minha bio', onboardingStep: 8 })
  })
})

describe('completeOnboarding', () => {
  it('exige passos anteriores', async () => {
    const res = await completeOnboarding(userCom({ id: 'vet-1' }))
    expect(res.success).toBe(false)
    expect(vets.saveVeterinario).not.toHaveBeenCalled()
  })

  it('exige a bio', async () => {
    const res = await completeOnboarding(userCom(vetCompleto({ bio: '' })))
    expect(res).toEqual({ success: false, errors: ['Descrição sobre você é obrigatória'] })
  })

  it('marca onboardingComplete = 1 (booleano Int)', async () => {
    const vet = vetCompleto()
    const res = await completeOnboarding(userCom(vet))
    expect(res).toEqual({ success: true, message: 'Onboarding concluído com sucesso!' })
    expect(vets.saveVeterinario).toHaveBeenCalledWith(vet, { onboardingComplete: 1 })
  })

  it('usuário sem veterinário: TypeError (500), como no Adonis', async () => {
    await expect(completeOnboarding({ id: 'u' } as never)).rejects.toBeInstanceOf(TypeError)
  })
})

describe('getProgress', () => {
  it('veterinário não encontrado: 404', async () => {
    vets.findVeterinarios.mockResolvedValueOnce([])
    const erro = await getProgress(userCom(vetCompleto())).catch((e) => e)
    expect(erro).toBeInstanceOf(HttpError)
    expect(erro.status).toBe(404)
    expect(erro.body).toEqual({ status: 404, message: 'Row not found' })
  })

  it('carrega relações e informa requisitos do próximo passo', async () => {
    vets.findVeterinarios.mockResolvedValueOnce([{ id: 'vet-1', crmv: null, onboardingStep: 1 }])
    const res = await getProgress(userCom(vetCompleto()))
    expect(vets.findVeterinarios).toHaveBeenCalledWith({ id: 'vet-1', userId: 'user-1' }, [
      'user',
      'especialidades',
      'enderecos',
      'planos',
      'experiencias',
    ])
    expect(res).toEqual({
      success: true,
      data: {
        veterinario: { serializado: 'vet-1' },
        currentStep: 1,
        canProceed: false,
        nextStepRequirements: ['CRMV é obrigatório'],
      },
    })
  })

  it('onboardingStep nulo conta como 0 e pode prosseguir', async () => {
    vets.findVeterinarios.mockResolvedValueOnce([{ id: 'vet-1', onboardingStep: null }])
    const res = await getProgress(userCom(vetCompleto()))
    expect(res.data).toMatchObject({ currentStep: null, canProceed: true, nextStepRequirements: [] })
  })
})