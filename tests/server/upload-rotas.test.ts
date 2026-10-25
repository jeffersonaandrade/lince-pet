import { describe, it, expect, vi, beforeEach, afterEach, beforeAll } from 'vitest'
import { NextRequest } from 'next/server'
import sharp from 'sharp'

const prismaMock = vi.hoisted(() => {
  const m = {
    veterinario: { findFirst: vi.fn(), update: vi.fn() },
    veterinarioEndereco: { findFirst: vi.fn(), update: vi.fn() },
    user: { findUnique: vi.fn(), update: vi.fn() },
    clinica: { update: vi.fn() },
    tutor: { findFirst: vi.fn() },
    pet: { findFirst: vi.fn(), update: vi.fn(), create: vi.fn() },
    prestador: { findFirst: vi.fn() },
    $transaction: vi.fn(),
  }
  m.$transaction.mockImplementation(async (ops: Promise<unknown>[]) => Promise.all(ops))
  return m
})
vi.mock('@/server/db', () => ({ prisma: prismaMock }))

const sessao = vi.hoisted(() => ({ user: {} as Record<string, unknown>, negar: false }))
vi.mock('@/server/auth/session', async (importOriginal) => {
  const { HttpError } = await import('@/server/http')
  return {
    ...(await importOriginal<typeof import('@/server/auth/session')>()),
    requireUser: vi.fn(async () => {
      if (sessao.negar) throw new HttpError(401, { errors: [{ message: 'Unauthorized access' }] })
      return sessao.user
    }),
  }
})

const servicos = vi.hoisted(() => ({ registerVeterinario: vi.fn(), salvarPasso3: vi.fn() }))
vi.mock('@/server/services/veterinarios', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/server/services/veterinarios')>()),
  registerVeterinario: servicos.registerVeterinario,
}))
vi.mock('@/server/services/prestadores', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/server/services/prestadores')>()),
  salvarPasso3: servicos.salvarPasso3,
}))

import { POST as cadastroVet } from '@/app/api/veterinarios/route'
import { POST as fotoPerfilVet } from '@/app/api/veterinarios/profile/photo/route'
import { POST as fotoLocal } from '@/app/api/veterinarios/locations/[id]/photo/route'
import { POST as fotoOnboarding } from '@/app/api/onboarding/photo/route'
import { POST as uploadGenerico } from '@/app/api/onboarding/upload-generic/route'
import { POST as fotoClinica } from '@/app/api/clinicas/upload-photo/route'
import { POST as step4 } from '@/app/api/clinicas/onboarding/step4/route'
import { POST as fotoPet } from '@/app/api/pets/[id]/photo/route'
import { POST as fotoTutor } from '@/app/api/tutor/profile/photo/route'
import { POST as passo3 } from '@/app/api/prestadores/onboarding/passo3/route'
import { POST as criarPet } from '@/app/api/pets/route'
import { PATCH as editarPet } from '@/app/api/pets/[id]/route'

const BASE = 'https://ref.supabase.co'
const PUBLICO = `${BASE}/storage/v1/object/public/lincepet-media`
const U_ID = '10000000-0000-4000-8000-000000000001'
const VET_ID = '20000000-0000-4000-8000-000000000002'
const END_ID = '30000000-0000-4000-8000-000000000003'
const CLI_ID = '40000000-0000-4000-8000-000000000004'
const PET_ID = '50000000-0000-4000-8000-000000000005'
const TUTOR_ID = '60000000-0000-4000-8000-000000000006'
const PREST_ID = '70000000-0000-4000-8000-000000000007'
const ANTIGA = `${PUBLICO}/pets/${PET_ID}/antiga.webp`
const LEGADA = 'https://d261ftrvo5a2p7.cloudfront.net/pets/a.jpeg'

let png: Buffer
beforeAll(async () => {
  png = await sharp({ create: { width: 20, height: 20, channels: 3, background: '#123456' } }).png().toBuffer()
})

const fetchMock = vi.fn()
const resposta = (status: number) =>
  ({ ok: status >= 200 && status < 300, status, headers: new Headers() }) as Response
const uploads = () => fetchMock.mock.calls.filter(([, i]) => i.method === 'POST').map(([url]) => String(url))
const deletes = () => fetchMock.mock.calls.filter(([, i]) => i.method === 'DELETE').map(([url]) => String(url))
const objeto = (url: string) => url.replace(`${BASE}/storage/v1/object/lincepet-media/`, '')

function multipart(campos: Record<string, string | Buffer>, nome = 'foto.png') {
  const form = new FormData()
  for (const [k, v] of Object.entries(campos)) {
    form.append(k, typeof v === 'string' ? v : new File([new Uint8Array(v)], nome, { type: 'image/png' }))
  }
  return new NextRequest('http://localhost/api/x', { method: 'POST', body: form })
}
const ctx = <P,>(params: P) => ({ params: Promise.resolve(params) })

beforeEach(() => {
  vi.clearAllMocks()
  fetchMock.mockReset()
  fetchMock.mockResolvedValue(resposta(200))
  vi.stubGlobal('fetch', fetchMock)
  vi.stubEnv('SUPABASE_URL', BASE)
  vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'segredo')
  vi.spyOn(console, 'error').mockImplementation(() => {})
  sessao.negar = false
  sessao.user = { id: U_ID, userType: 'veterinario', profilePic: null, clinica: null }
  prismaMock.veterinario.findFirst.mockResolvedValue({ id: VET_ID, userId: U_ID, fotoUrl: null })
  prismaMock.veterinarioEndereco.findFirst.mockResolvedValue({ id: END_ID, veterinarioId: VET_ID, fotoUrl: null })
  prismaMock.tutor.findFirst.mockResolvedValue({ id: TUTOR_ID, userId: U_ID })
  prismaMock.pet.findFirst.mockResolvedValue({ id: PET_ID, tutorId: TUTOR_ID, fotoUrl: ANTIGA })
  prismaMock.prestador.findFirst.mockResolvedValue({ id: PREST_ID, userId: U_ID, fotoUrl: null })
  prismaMock.user.findUnique.mockResolvedValue({ id: U_ID, profilePic: null })
  for (const op of [
    prismaMock.veterinario.update,
    prismaMock.veterinarioEndereco.update,
    prismaMock.user.update,
    prismaMock.clinica.update,
    prismaMock.pet.update,
  ]) {
    op.mockResolvedValue({})
  }
  servicos.registerVeterinario.mockResolvedValue(VET_ID)
  servicos.salvarPasso3.mockResolvedValue(undefined)
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

describe('autenticação e posse', () => {
  it.each([
    ['perfil vet', () => fotoPerfilVet(multipart({ profile_pic: png }), ctx({}))],
    ['local', () => fotoLocal(multipart({ photo: png }), ctx({ id: END_ID }))],
    ['onboarding', () => fotoOnboarding(multipart({ profile_pic: png }), ctx({}))],
    ['genérico', () => uploadGenerico(multipart({ file: png }), ctx({}))],
    ['clínica', () => fotoClinica(multipart({ profile_pic: png }), ctx({}))],
    ['step4', () => step4(multipart({ fotoPerfil: png }), ctx({}))],
    ['pet', () => fotoPet(multipart({ photo: png }), ctx({ id: PET_ID }))],
    ['tutor', () => fotoTutor(multipart({ profile_pic: png }), ctx({}))],
    ['prestador', () => passo3(multipart({ foto: png }), ctx({}))],
  ])('%s: sem login responde 401 e não envia nada', async (_, chamar) => {
    sessao.negar = true
    const res = await chamar()
    expect(res.status).toBe(401)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('pet de outro tutor responde 404 sem upload', async () => {
    prismaMock.pet.findFirst.mockResolvedValue(null)
    const res = await fotoPet(multipart({ photo: png }), ctx({ id: PET_ID }))
    expect(res.status).toBe(404)
    expect(prismaMock.pet.findFirst.mock.calls[0][0].where).toEqual({ id: PET_ID, tutorId: TUTOR_ID, arquivadoEm: null })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('endereço de outro veterinário responde 404 sem upload', async () => {
    prismaMock.veterinarioEndereco.findFirst.mockResolvedValue(null)
    const res = await fotoLocal(multipart({ photo: png }), ctx({ id: END_ID }))
    expect(res.status).toBe(404)
    expect(prismaMock.veterinarioEndereco.findFirst.mock.calls[0][0].where).toEqual({ id: END_ID, veterinarioId: VET_ID })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it.each([
    ['perfil vet', () => fotoPerfilVet(multipart({ profile_pic: png }), ctx({}))],
    ['onboarding', () => fotoOnboarding(multipart({ profile_pic: png }), ctx({}))],
    ['genérico', () => uploadGenerico(multipart({ file: png }), ctx({}))],
  ])('%s: usuário sem veterinário responde 404', async (_, chamar) => {
    prismaMock.veterinario.findFirst.mockResolvedValue(null)
    expect((await chamar()).status).toBe(404)
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

describe('upload, persistência e contrato', () => {
  it('perfil do veterinário grava fotoUrl e devolve { message, url }', async () => {
    const res = await fotoPerfilVet(multipart({ profile_pic: png }), ctx({}))
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body).toEqual({ message: 'Foto de perfil atualizada com sucesso', url: expect.stringMatching(/\.webp$/) })
    expect(objeto(uploads()[0])).toMatch(new RegExp(`^veterinarios/${VET_ID}/perfil/[0-9a-f-]+\\.webp$`))
    expect(body.url.startsWith(`${PUBLICO}/veterinarios/${VET_ID}/perfil/`)).toBe(true)
    expect(prismaMock.veterinario.update.mock.calls[0][0]).toMatchObject({ where: { id: VET_ID }, data: { fotoUrl: body.url } })
  })

  it('perfil do veterinário não apaga a foto anterior que ainda é a profilePic do usuário', async () => {
    const velha = `${PUBLICO}/veterinarios/${VET_ID}/perfil/velha.webp`
    prismaMock.veterinario.findFirst.mockResolvedValue({ id: VET_ID, fotoUrl: velha })
    sessao.user.profilePic = velha
    await fotoPerfilVet(multipart({ profile_pic: png }), ctx({}))
    expect(deletes()).toEqual([])
  })

  it('foto do local grava no endereço e apaga a anterior do bucket', async () => {
    const velha = `${PUBLICO}/veterinarios/${VET_ID}/locais/${END_ID}/velha.webp`
    prismaMock.veterinarioEndereco.findFirst.mockResolvedValue({ id: END_ID, veterinarioId: VET_ID, fotoUrl: velha })
    const res = await fotoLocal(multipart({ photo: png }), ctx({ id: END_ID }))
    const body = await res.json()
    expect(body).toEqual({ url: expect.any(String), message: 'Foto do local enviada com sucesso' })
    expect(objeto(uploads()[0])).toMatch(new RegExp(`^veterinarios/${VET_ID}/locais/${END_ID}/`))
    expect(prismaMock.veterinarioEndereco.update.mock.calls[0][0].data.fotoUrl).toBe(body.url)
    expect(deletes().map(objeto)).toEqual([`veterinarios/${VET_ID}/locais/${END_ID}/velha.webp`])
  })

  it('onboarding grava veterinário e usuário na mesma transação', async () => {
    const res = await fotoOnboarding(multipart({ avatar: png }), ctx({}))
    const body = await res.json()
    expect(body).toEqual({ message: 'Foto adicionada ao perfil com sucesso', url: expect.any(String) })
    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1)
    expect(prismaMock.veterinario.update.mock.calls[0][0].data.fotoUrl).toBe(body.url)
    expect(prismaMock.user.update.mock.calls[0][0].data.profilePic).toBe(body.url)
  })

  it('upload genérico só devolve { url } na pasta uploads do veterinário', async () => {
    const res = await uploadGenerico(multipart({ image: png }), ctx({}))
    expect(await res.json()).toEqual({ url: expect.stringContaining(`/veterinarios/${VET_ID}/uploads/`) })
    expect(prismaMock.veterinario.update).not.toHaveBeenCalled()
  })

  it('foto da clínica grava fotoPerfil e profilePic', async () => {
    sessao.user = { id: U_ID, userType: 'clinica', profilePic: null, clinica: { id: CLI_ID, fotoPerfil: null, fotoCapa: null } }
    const res = await fotoClinica(multipart({ profile_pic: png }), ctx({}))
    const body = await res.json()
    expect(body).toEqual({ url: expect.stringContaining(`/clinicas/${CLI_ID}/perfil/`), message: 'Foto de perfil atualizada com sucesso' })
    expect(prismaMock.clinica.update.mock.calls[0][0]).toMatchObject({ where: { id: CLI_ID }, data: { fotoPerfil: body.url } })
    expect(prismaMock.user.update.mock.calls[0][0].data.profilePic).toBe(body.url)
  })

  it('usuário que não é clínica responde 401 no upload da clínica', async () => {
    expect((await fotoClinica(multipart({ profile_pic: png }), ctx({}))).status).toBe(401)
  })

  it('step4 com arquivo grava a foto e devolve fotoUrl', async () => {
    const clinica = { id: CLI_ID, fotoPerfil: null, fotoCapa: null, nomeClinica: 'Velho' }
    sessao.user = { id: U_ID, userType: 'clinica', profilePic: null, clinica }
    const res = await step4(multipart({ fotoPerfil: png, nome: 'Nova' }), ctx({}))
    const body = await res.json()
    expect(body.message).toBe('Perfil salvo com sucesso')
    expect(body.fotoUrl).toContain(`/clinicas/${CLI_ID}/perfil/`)
    expect(prismaMock.clinica.update.mock.calls[0][0].data).toMatchObject({ fotoPerfil: body.fotoUrl, nomeClinica: 'Nova' })
    expect(prismaMock.user.update.mock.calls[0][0].data).toMatchObject({ profilePic: body.fotoUrl, nome: 'Nova' })
  })

  it('step4 sem arquivo aceita fotoUrl do nosso bucket e não chama o storage', async () => {
    const nossa = `${PUBLICO}/clinicas/${CLI_ID}/perfil/a.webp`
    sessao.user = { id: U_ID, userType: 'clinica', profilePic: null, clinica: { id: CLI_ID, fotoPerfil: null } }
    const res = await step4(multipart({ fotoUrl: nossa }), ctx({}))
    expect((await res.json()).fotoUrl).toBe(nossa)
    expect(prismaMock.user.update.mock.calls[0][0].data.profilePic).toBe(nossa)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it.each([
    ['site externo', 'https://exemplo.com/a.png'],
    ['bucket de outro projeto', 'https://outro.supabase.co/storage/v1/object/public/lincepet-media/clinicas/x/a.webp'],
    ['legado da AWS', LEGADA],
    ['travessia de pasta', `${PUBLICO}/clinicas/../segredo.webp`],
  ])('step4 recusa fotoUrl de %s com 400 sem gravar', async (_, url) => {
    sessao.user = { id: U_ID, userType: 'clinica', profilePic: null, clinica: { id: CLI_ID, fotoPerfil: null } }
    const res = await step4(multipart({ fotoUrl: url, nome: 'Nova' }), ctx({}))
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ message: 'A foto precisa ser enviada pelo upload da Lince Pet' })
    expect(prismaMock.clinica.update).not.toHaveBeenCalled()
    expect(prismaMock.user.update).not.toHaveBeenCalled()
  })

  it('pet grava fotoUrl e apaga a foto anterior do nosso bucket', async () => {
    const res = await fotoPet(multipart({ photo: png }), ctx({ id: PET_ID }))
    const body = await res.json()
    expect(body).toEqual({ message: 'Foto do pet atualizada com sucesso', url: expect.stringContaining(`/pets/${PET_ID}/`) })
    expect(prismaMock.pet.update.mock.calls[0][0]).toMatchObject({ where: { id: PET_ID }, data: { fotoUrl: body.url } })
    expect(deletes().map(objeto)).toEqual([`pets/${PET_ID}/antiga.webp`])
  })

  it('pet com foto legada da AWS não apaga nada', async () => {
    prismaMock.pet.findFirst.mockResolvedValue({ id: PET_ID, tutorId: TUTOR_ID, fotoUrl: LEGADA })
    await fotoPet(multipart({ photo: png }), ctx({ id: PET_ID }))
    expect(deletes()).toEqual([])
  })

  it('tutor grava profilePic com caminho do próprio usuário', async () => {
    sessao.user = { id: U_ID, userType: 'tutor' }
    const res = await fotoTutor(multipart({ profile_pic: png }), ctx({}))
    const body = await res.json()
    expect(body).toEqual({ message: 'Foto de perfil atualizada com sucesso', url: expect.stringContaining(`/tutores/${U_ID}/`) })
    expect(prismaMock.user.update.mock.calls[0][0]).toMatchObject({ where: { id: U_ID }, data: { profilePic: body.url } })
  })

  it('tutor inexistente no banco responde 404', async () => {
    prismaMock.user.findUnique.mockResolvedValue(null)
    expect((await fotoTutor(multipart({ profile_pic: png }), ctx({}))).status).toBe(404)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('prestador grava a foto via salvarPasso3 e profilePic; devolve foto_url', async () => {
    const res = await passo3(multipart({ foto: png, apresentacao: 'Oi' }), ctx({}))
    const body = await res.json()
    expect(body).toEqual({ message: 'Perfil concluído', foto_url: expect.stringContaining(`/prestadores/${PREST_ID}/`) })
    expect(servicos.salvarPasso3.mock.calls[0][2]).toBe(body.foto_url)
    expect(prismaMock.user.update.mock.calls[0][0].data.profilePic).toBe(body.foto_url)
  })

  it('prestador sem foto conclui com foto_url null', async () => {
    const res = await passo3(multipart({ apresentacao: 'Oi' }), ctx({}))
    expect(await res.json()).toEqual({ message: 'Perfil concluído', foto_url: null })
    expect(servicos.salvarPasso3.mock.calls[0][2]).toBeNull()
  })

  it('cadastro de veterinário registra e depois envia a foto para a pasta do novo veterinário', async () => {
    const res = await cadastroVet(
      multipart({ profile_pic: png, email: 'a@b.com', password: 'senha123', nome: 'Ana', sobrenome: 'Vet', celular: '81999999999' }),
      ctx({})
    )
    expect(res.status).toBe(201)
    expect(await res.json()).toEqual({ message: 'Veterinário registrado com sucesso' })
    expect(objeto(uploads()[0])).toMatch(new RegExp(`^veterinarios/${VET_ID}/perfil/`))
    expect(prismaMock.veterinario.update.mock.calls[0][0].where).toEqual({ id: VET_ID })
  })

  it('cadastro conclui mesmo se a foto falhar', async () => {
    fetchMock.mockResolvedValue(resposta(500))
    const res = await cadastroVet(
      multipart({ profile_pic: png, email: 'a@b.com', password: 'senha123', nome: 'Ana', sobrenome: 'Vet', celular: '81999999999' }),
      ctx({})
    )
    expect(res.status).toBe(201)
    expect(prismaMock.veterinario.update).not.toHaveBeenCalled()
  })
})

describe('foto_url enviada no JSON do pet', () => {
  const corpo = (dados: Record<string, unknown>, method = 'POST') =>
    new NextRequest('http://localhost/api/pets', {
      method,
      body: JSON.stringify(dados),
      headers: { 'content-type': 'application/json' },
    })
  const NOSSA = `${PUBLICO}/pets/${PET_ID}/nova.webp`

  beforeEach(() => {
    sessao.user = { id: U_ID, userType: 'tutor' }
    prismaMock.pet.create.mockImplementation(async ({ data }) => ({ id: PET_ID, ...data }))
    prismaMock.pet.update.mockImplementation(async ({ data }) => ({ id: PET_ID, ...data }))
  })

  it('criar aceita URL do nosso bucket', async () => {
    const res = await criarPet(corpo({ nome: 'Rex', especie: 'cachorro', foto_url: NOSSA }), ctx({}))
    expect(res.status).toBe(201)
    expect(prismaMock.pet.create.mock.calls[0][0].data.fotoUrl).toBe(NOSSA)
  })

  it('criar sem foto grava null', async () => {
    await criarPet(corpo({ nome: 'Rex', especie: 'cachorro' }), ctx({}))
    expect(prismaMock.pet.create.mock.calls[0][0].data.fotoUrl).toBeNull()
  })

  it.each([
    ['site externo', 'https://rastreador.exemplo.com/pixel.png'],
    ['legado da AWS', LEGADA],
  ])('criar recusa URL de %s com 400 sem gravar', async (_, url) => {
    const res = await criarPet(corpo({ nome: 'Rex', especie: 'cachorro', foto_url: url }), ctx({}))
    expect(res.status).toBe(400)
    expect(prismaMock.pet.create).not.toHaveBeenCalled()
  })

  it('editar recusa URL externa com 400 e mantém a foto atual', async () => {
    const res = await editarPet(corpo({ foto_url: 'https://exemplo.com/a.png' }, 'PATCH'), ctx({ id: PET_ID }))
    expect(res.status).toBe(400)
    expect(prismaMock.pet.update).not.toHaveBeenCalled()
  })

  it('editar troca para outra foto do nosso bucket', async () => {
    const res = await editarPet(corpo({ foto_url: NOSSA }, 'PATCH'), ctx({ id: PET_ID }))
    expect(res.status).toBe(200)
    expect(prismaMock.pet.update.mock.calls[0][0]).toMatchObject({ where: { id: PET_ID }, data: { fotoUrl: NOSSA } })
  })
})

describe('falhas', () => {
  it('conteúdo que não é imagem responde 400 sem chamar o storage', async () => {
    const res = await fotoPerfilVet(multipart({ profile_pic: Buffer.from('<?php echo 1; ?>') }, 'foto.png'), ctx({}))
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ message: 'Arquivo de imagem inválido' })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('extensão fora da lista responde 400', async () => {
    const res = await fotoPet(multipart({ photo: png }, 'foto.svg'), ctx({ id: PET_ID }))
    expect(res.status).toBe(400)
    expect((await res.json()).message).toBe('Arquivo inválido')
  })

  it('arquivo acima de 5 MB responde 400', async () => {
    const res = await fotoTutor(multipart({ profile_pic: Buffer.alloc(5 * 1024 * 1024 + 10) }), ctx({}))
    expect(res.status).toBe(400)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('falha do Supabase responde 500 com a mensagem da rota', async () => {
    fetchMock.mockResolvedValue(resposta(500))
    const res = await fotoPerfilVet(multipart({ profile_pic: png }), ctx({}))
    expect(res.status).toBe(500)
    expect(await res.json()).toEqual({ message: 'Erro ao enviar foto de perfil' })
    expect(prismaMock.veterinario.update).not.toHaveBeenCalled()
  })

  it.each([
    ['pet', () => fotoPet(multipart({ photo: png }), ctx({ id: PET_ID })), () => prismaMock.pet.update],
    ['tutor', () => fotoTutor(multipart({ profile_pic: png }), ctx({})), () => prismaMock.user.update],
    ['local', () => fotoLocal(multipart({ photo: png }), ctx({ id: END_ID })), () => prismaMock.veterinarioEndereco.update],
  ])('%s: se o banco falhar, o objeto enviado é apagado', async (_, chamar, op) => {
    op().mockRejectedValue(new Error('db fora'))
    const res = await chamar()
    expect(res.status).toBe(500)
    expect(deletes()).toEqual([uploads()[0]])
  })

  it('prestador: falha em salvarPasso3 apaga o objeto e não grava profilePic', async () => {
    servicos.salvarPasso3.mockRejectedValue(new Error('validação'))
    const res = await passo3(multipart({ foto: png }), ctx({}))
    expect(res.status).toBe(500)
    expect(deletes()).toEqual([uploads()[0]])
    expect(prismaMock.user.update).not.toHaveBeenCalled()
  })

  it('multipart ausente responde 400', async () => {
    const req = new NextRequest('http://localhost/api/x', { method: 'POST', body: '{}', headers: { 'content-type': 'application/json' } })
    expect((await fotoTutor(req, ctx({}))).status).toBe(400)
  })
})
