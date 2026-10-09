import { describe, it, expect, vi, beforeEach } from 'vitest'

const prismaMock = vi.hoisted(() => {
  const tx = {
    veterinario: { update: vi.fn() },
    veterinarioEndereco: { deleteMany: vi.fn(), create: vi.fn() },
  }
  return {
    tx,
    veterinario: { findMany: vi.fn(), update: vi.fn() },
    especialidadeRelacionamento: { findMany: vi.fn() },
    $transaction: vi.fn(async (fn: (t: typeof tx) => unknown) => fn(tx)),
  }
})
vi.mock('@/server/db', () => ({ prisma: prismaMock }))
vi.mock('@/server/services/subscription', () => ({ canCreateAppointment: vi.fn(async () => ({ allowed: true })) }))

import { step4Validator } from '@/server/validators/onboarding'
import { processStep4 } from '@/server/services/onboarding'
import { getVeterinarioById } from '@/server/services/veterinarios'

const local = {
  rua: 'Rua A',
  numero: '10',
  bairro: 'Centro',
  cidade: 'Recife',
  estado: 'PE',
  cep: '50000000',
  precoConsulta: 150,
  horariosDisponibilidade: { segunda: ['09:00'] },
  fotoUrl: 'https://cdn.exemplo.com/local.jpg',
}

beforeEach(() => vi.clearAllMocks())

describe('onboarding passo 4: foto do local', () => {
  it('validator preserva fotoUrl e processStep4 grava no endereço', async () => {
    const payload = await step4Validator.validate({
      visitTypes: { presencial: true, online: false },
      locations: [local],
    })
    expect(payload.locations?.[0].fotoUrl).toBe(local.fotoUrl)

    const user = { veterinario: { id: 'vet-1', crmv: '123', genero: 'feminino', onboardingStep: 4 } }
    const res = await processStep4(user as never, payload)
    expect(res.success).toBe(true)
    expect(prismaMock.tx.veterinarioEndereco.create.mock.calls[0][0].data.fotoUrl).toBe(local.fotoUrl)
  })

  it('local sem foto continua null', async () => {
    const { fotoUrl: _, ...semFoto } = local
    const payload = await step4Validator.validate({ visitTypes: { presencial: true, online: false }, locations: [semFoto] })
    const user = { veterinario: { id: 'vet-1', crmv: '123', genero: 'feminino', onboardingStep: 4 } }
    await processStep4(user as never, payload)
    expect(prismaMock.tx.veterinarioEndereco.create.mock.calls[0][0].data.fotoUrl).toBeNull()
  })
})

describe('página do veterinário: nota', () => {
  it('getVeterinarioById carrega avaliações e calcula rating/totalReviews', async () => {
    prismaMock.veterinario.findMany.mockResolvedValue([
      { id: 'vet-1', user: null, enderecos: [], experiencias: [], veterinarioPlanos: [], avaliacoes: [{ estrelas: 4 }, { estrelas: 5 }] },
    ])
    prismaMock.especialidadeRelacionamento.findMany.mockResolvedValue([])

    const vet = await getVeterinarioById('vet-1')
    expect(prismaMock.veterinario.findMany.mock.calls[0][0].include.avaliacoes).toBe(true)
    expect(vet.rating).toBe(4.5)
    expect(vet.totalReviews).toBe(2)
  })
})
