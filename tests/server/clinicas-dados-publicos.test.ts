import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const prismaMock = vi.hoisted(() => ({
  clinica: { findFirst: vi.fn(), findMany: vi.fn() },
  veterinario: { findMany: vi.fn() },
  especialidadeRelacionamento: { findMany: vi.fn() },
  $queryRaw: vi.fn(),
}))
vi.mock('@/server/db', () => ({ prisma: prismaMock }))

const sessao = vi.hoisted(() => ({ requireUser: vi.fn() }))
vi.mock('@/server/auth/session', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/server/auth/session')>()),
  ...sessao,
}))

import { GET as detalheDaClinica } from '@/app/api/clinicas/[id]/route'
import { GET as listaDeClinicas } from '@/app/api/clinicas/route'
import { GET as buscaDeProfissionais } from '@/app/api/clinicas/professionals/search/route'
import { HttpError } from '@/server/http'

const usuario = (id: string) => ({
  id,
  nome: 'Ana',
  sobrenome: 'Lima',
  profilePic: null,
  email: `${id}@x.com`,
  celular: '11999999999',
  cep: '01000000',
  rua: 'Rua Secreta',
  numero: '1',
  password: 'hash',
  googleRefreshToken: 'tok',
})
const publico = (id: string) => ({ id, nome: 'Ana', sobrenome: 'Lima', profilePic: null })

beforeEach(() => {
  vi.clearAllMocks()
  prismaMock.especialidadeRelacionamento.findMany.mockResolvedValue([])
})

describe('GET /api/clinicas/:id (público)', () => {
  it('mostra só nome e foto do usuário da clínica e dos veterinários', async () => {
    prismaMock.clinica.findFirst.mockResolvedValue({
      id: 'c1',
      nomeClinica: 'Clínica Sol',
      user: usuario('u-clinica'),
      clinicaPlanos: [],
      avaliacoes: [],
      veterinarioClinicas: [{ veterinario: { id: 'v1', user: usuario('u-vet'), avaliacoes: [], enderecos: [] } }],
    })

    const res = await detalheDaClinica(new NextRequest('http://localhost/api/clinicas/c1'), {
      params: Promise.resolve({ id: 'c1' }),
    })
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.user).toEqual(publico('u-clinica'))
    expect(body.veterinarios[0].user).toEqual(publico('u-vet'))
  })
})

describe('GET /api/clinicas (público)', () => {
  it('lista clínicas sem dados de contato do usuário dono', async () => {
    prismaMock.clinica.findMany.mockResolvedValue([
      { id: 'c1', user: usuario('u-1'), clinicaPlanos: [], avaliacoes: [] },
      { id: 'c2', user: null, clinicaPlanos: [], avaliacoes: [] },
    ])

    const res = await listaDeClinicas(new NextRequest('http://localhost/api/clinicas'), { params: Promise.resolve({}) })
    const body = await res.json()

    expect(body.map((c: { user: unknown }) => c.user)).toEqual([publico('u-1'), null])
  })
})

describe('GET /api/clinicas/professionals/search', () => {
  const buscar = (query: string) =>
    buscaDeProfissionais(new NextRequest(`http://localhost/api/clinicas/professionals/search${query}`), {
      params: Promise.resolve({}),
    })

  it('só clínica pode buscar: outro perfil recebe 403 sem consultar o banco', async () => {
    sessao.requireUser.mockRejectedValueOnce(new HttpError(403, { message: 'Acesso negado' }))
    const res = await buscar('?search=ana')
    expect(res.status).toBe(403)
    expect(sessao.requireUser).toHaveBeenCalledWith(expect.anything(), ['clinica'])
    expect(prismaMock.$queryRaw).not.toHaveBeenCalled()
    expect(prismaMock.veterinario.findMany).not.toHaveBeenCalled()
  })

  it('clínica vê nome, foto e e-mail, mas não celular, endereço nem segredos', async () => {
    sessao.requireUser.mockResolvedValueOnce({ id: 'u-c', userType: 'clinica' })
    prismaMock.$queryRaw.mockResolvedValue([{ id: 'v1' }])
    prismaMock.veterinario.findMany.mockResolvedValue([{ id: 'v1', crmv: 'SP-1', user: usuario('u-vet') }])

    const res = await buscar('?search=ana')
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.profissionais).toEqual([
      { id: 'v1', crmv: 'SP-1', user: { ...publico('u-vet'), email: 'u-vet@x.com' } },
    ])
  })

  it('busca vinda como filtro (?search[x]=) não vira termo; cai na listagem padrão', async () => {
    sessao.requireUser.mockResolvedValueOnce({ id: 'u-c', userType: 'clinica' })
    prismaMock.veterinario.findMany.mockResolvedValue([])

    await buscar('?search[not]=x')

    expect(prismaMock.$queryRaw).not.toHaveBeenCalled()
    expect(prismaMock.veterinario.findMany).toHaveBeenCalledWith({ take: 40, include: { user: true } })
  })
})
