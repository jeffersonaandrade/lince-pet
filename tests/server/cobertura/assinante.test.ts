import { describe, it, expect, vi, beforeEach } from 'vitest'

import {
  assinanteDaAssinatura,
  assinanteDe,
  assinaturasDo,
  definirPlano,
  donoDaAssinatura,
  garantirClienteAsaas,
  planoAtualDe,
  referenciaExterna,
} from '@/server/services/assinante'

const db = {
  veterinario: { update: vi.fn(), findUnique: vi.fn() },
  prestador: { update: vi.fn(), findUnique: vi.fn() },
  clinica: { update: vi.fn(), findUnique: vi.fn() },
}
const tx = db as never

beforeEach(() => {
  vi.clearAllMocks()
})

describe('assinanteDe', () => {
  it('vet e clínica começam em none; prestador em free; contador vem do perfil', () => {
    expect(
      assinanteDe({ userType: 'veterinario', veterinario: { id: 'v', subscriptionPlanCode: 'vet_pro', monthlyAppointmentsUsed: 3 } } as never)
    ).toEqual({ tipo: 'veterinario', id: 'v', planoAtual: 'vet_pro', planoPadrao: 'none', usado: 3 })
    expect(assinanteDe({ userType: 'clinica', clinica: { id: 'c', subscriptionPlanCode: null } } as never)).toEqual({
      tipo: 'clinica',
      id: 'c',
      planoAtual: null,
      planoPadrao: 'none',
      usado: 0,
    })
    expect(
      assinanteDe({ userType: 'prestador', prestador: { id: 'p', subscriptionPlanCode: 'free', monthlyAppointmentsUsed: null } } as never)
    ).toMatchObject({ tipo: 'prestador', planoPadrao: 'free', usado: 0 })
  })

  it('contador nulo do vet vira 0', () => {
    expect(
      assinanteDe({ userType: 'veterinario', veterinario: { id: 'v', subscriptionPlanCode: null, monthlyAppointmentsUsed: null } } as never)!
        .usado
    ).toBe(0)
  })

  it('tutor ou tipo sem o perfil carregado não é assinante', () => {
    expect(assinanteDe({ userType: 'tutor' } as never)).toBeNull()
    expect(assinanteDe({ userType: 'veterinario', veterinario: null } as never)).toBeNull()
    expect(assinanteDe({ userType: 'clinica', clinica: null } as never)).toBeNull()
    expect(assinanteDe({ userType: 'prestador', prestador: null } as never)).toBeNull()
  })
})

describe('dono, filtro e referência externa', () => {
  it('uma coluna de dono preenchida por tipo', () => {
    expect(donoDaAssinatura({ tipo: 'veterinario', id: 'v' })).toEqual({ veterinarioId: 'v', clinicaId: null, prestadorId: null })
    expect(donoDaAssinatura({ tipo: 'clinica', id: 'c' })).toEqual({ veterinarioId: null, clinicaId: 'c', prestadorId: null })
    expect(donoDaAssinatura({ tipo: 'prestador', id: 'p' })).toEqual({ veterinarioId: null, clinicaId: null, prestadorId: 'p' })
  })

  it('filtro por dono', () => {
    expect(assinaturasDo({ tipo: 'veterinario', id: 'v' })).toEqual({ veterinarioId: 'v' })
    expect(assinaturasDo({ tipo: 'clinica', id: 'c' })).toEqual({ clinicaId: 'c' })
    expect(assinaturasDo({ tipo: 'prestador', id: 'p' })).toEqual({ prestadorId: 'p' })
  })

  it('referência do Asaas: vet:<id>, clinica:<id>, prestador:<id>', () => {
    expect(referenciaExterna({ tipo: 'veterinario', id: 'v' })).toBe('vet:v')
    expect(referenciaExterna({ tipo: 'clinica', id: 'c' })).toBe('clinica:c')
    expect(referenciaExterna({ tipo: 'prestador', id: 'p' })).toBe('prestador:p')
  })

  it('assinanteDaAssinatura acha o dono pela coluna preenchida; sem dono, null', () => {
    const vazio = { veterinarioId: null, clinicaId: null, prestadorId: null }
    expect(assinanteDaAssinatura({ ...vazio, veterinarioId: 'v' })).toEqual({ tipo: 'veterinario', id: 'v' })
    expect(assinanteDaAssinatura({ ...vazio, clinicaId: 'c' })).toEqual({ tipo: 'clinica', id: 'c' })
    expect(assinanteDaAssinatura({ ...vazio, prestadorId: 'p' })).toEqual({ tipo: 'prestador', id: 'p' })
    expect(assinanteDaAssinatura(vazio)).toBeNull()
  })
})

describe('definirPlano', () => {
  it('vet e prestador zeram o contador ao trocar de plano', async () => {
    await definirPlano(tx, { tipo: 'veterinario', id: 'v' }, 'vet_pro')
    expect(db.veterinario.update.mock.calls[0][0]).toMatchObject({
      where: { id: 'v' },
      data: { subscriptionPlanCode: 'vet_pro', monthlyAppointmentsUsed: 0, monthlyAppointmentsResetAt: expect.any(Date) },
    })
    await definirPlano(tx, { tipo: 'prestador', id: 'p' }, 'pro')
    expect(db.prestador.update.mock.calls[0][0].data).toMatchObject({ subscriptionPlanCode: 'pro', monthlyAppointmentsUsed: 0 })
  })

  it('zerarContador:false mantém o contador', async () => {
    await definirPlano(tx, { tipo: 'prestador', id: 'p' }, 'free', false)
    expect(db.prestador.update.mock.calls[0][0].data).not.toHaveProperty('monthlyAppointmentsUsed')
    expect(db.prestador.update.mock.calls[0][0].data.subscriptionPlanCode).toBe('free')
  })

  it('clínica não tem contador mensal', async () => {
    await definirPlano(tx, { tipo: 'clinica', id: 'c' }, 'clinic')
    expect(db.clinica.update.mock.calls[0][0].data).not.toHaveProperty('monthlyAppointmentsUsed')
    expect(db.clinica.update.mock.calls[0][0].data.subscriptionPlanCode).toBe('clinic')
  })
})

describe('planoAtualDe', () => {
  it('lê o plano na tabela do dono; sem registro, undefined', async () => {
    db.veterinario.findUnique.mockResolvedValueOnce({ subscriptionPlanCode: 'vet_starter' })
    expect(await planoAtualDe(tx, { tipo: 'veterinario', id: 'v' })).toBe('vet_starter')
    expect(db.veterinario.findUnique).toHaveBeenCalledWith({ where: { id: 'v' }, select: { subscriptionPlanCode: true } })

    db.prestador.findUnique.mockResolvedValueOnce({ subscriptionPlanCode: 'pro' })
    expect(await planoAtualDe(tx, { tipo: 'prestador', id: 'p' })).toBe('pro')

    db.clinica.findUnique.mockResolvedValueOnce(null)
    expect(await planoAtualDe(tx, { tipo: 'clinica', id: 'c' })).toBeUndefined()
  })
})

describe('garantirClienteAsaas', () => {
  it('usa o cadastro de cliente do tipo do assinante', async () => {
    const service = {
      ensureCustomerForVeterinario: vi.fn().mockResolvedValue({ id: 'cus_v' }),
      ensureCustomerForPrestador: vi.fn().mockResolvedValue({ id: 'cus_p' }),
      ensureCustomerForClinica: vi.fn().mockResolvedValue({ id: 'cus_c' }),
    }
    const user = { veterinario: { id: 'v' }, prestador: { id: 'p' }, clinica: { id: 'c' } } as never
    const base = { planoAtual: null, planoPadrao: 'none', usado: 0 }

    await garantirClienteAsaas(service as never, user, { ...base, tipo: 'veterinario', id: 'v' })
    await garantirClienteAsaas(service as never, user, { ...base, tipo: 'prestador', id: 'p' })
    await garantirClienteAsaas(service as never, user, { ...base, tipo: 'clinica', id: 'c' })

    expect(service.ensureCustomerForVeterinario).toHaveBeenCalledWith(user, { id: 'v' })
    expect(service.ensureCustomerForPrestador).toHaveBeenCalledWith(user, { id: 'p' })
    expect(service.ensureCustomerForClinica).toHaveBeenCalledWith(user, { id: 'c' })
  })
})
