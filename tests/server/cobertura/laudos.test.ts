import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { HttpError } from '@/server/http'

vi.mock('next/server', async (importOriginal) => ({
  ...(await importOriginal<typeof import('next/server')>()),
  after: (fn: () => unknown) => fn(),
}))

const prismaMock = vi.hoisted(() => ({
  agendamento: { findFirst: vi.fn() },
  laudoExame: { upsert: vi.fn() },
}))
vi.mock('@/server/db', () => ({ prisma: prismaMock }))

const acessoMock = vi.hoisted(() => vi.fn())
vi.mock('@/server/services/prontuario', () => ({ assertAcessoProntuario: acessoMock }))

const avisoMock = vi.hoisted(() => vi.fn())
vi.mock('@/server/services/exames-avisos', () => ({ avisarExame: avisoMock }))
vi.mock('@/server/services/exames', () => ({ TIPO_EXAME: 'exame' }))

import { enviarLaudo, urlDoLaudo } from '@/server/services/laudos'
import {
  chaveDoLaudo,
  ehPdf,
  lerLaudoLocal,
  removerLaudo,
  salvarLaudo,
  TAMANHO_MAXIMO_LAUDO,
  urlAssinadaDoLaudo,
} from '@/server/services/laudos-storage'

const CLINICA = '11111111-1111-4111-8111-111111111111'
const AG = '22222222-2222-4222-8222-222222222222'
const PDF = Buffer.from('%PDF-1.4\n%fake\n')
const passado = new Date(Date.now() - 3600_000)
const tutor = { id: 'u1', userType: 'tutor' } as never

const exame = (over: Record<string, unknown> = {}) => ({ id: AG, clinicaId: CLINICA, status: 'realizado', inicioEm: passado, laudo: null, ...over })

let dir: string
const fetchMock = vi.fn()

beforeEach(async () => {
  vi.clearAllMocks()
  dir = await mkdtemp(path.join(tmpdir(), 'laudos-'))
  vi.stubEnv('LAUDOS_STORAGE_DIR', dir)
  vi.stubEnv('LAUDOS_STORAGE_SECRET', 'segredo-de-teste')
  vi.stubGlobal('fetch', fetchMock)
  prismaMock.laudoExame.upsert.mockResolvedValue({})
})

afterEach(async () => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  await rm(dir, { recursive: true, force: true })
})

describe('regras do arquivo', () => {
  it('PDF pelo conteúdo (%PDF-), não pela extensão', () => {
    expect(ehPdf(PDF)).toBe(true)
    expect(ehPdf(Buffer.from('<html>'))).toBe(false)
    expect(ehPdf(Buffer.from('%PDF'))).toBe(false)
  })

  it('chave só com ids do banco', () => {
    expect(chaveDoLaudo(CLINICA, AG)).toMatch(new RegExp(`^clinicas/${CLINICA}/${AG}/[0-9a-f-]{36}\\.pdf$`))
    expect(() => chaveDoLaudo('../x', AG)).toThrow(/inválido/)
  })
})

describe('enviarLaudo', () => {
  it('grava o PDF, faz upsert e avisa tutor e vet solicitante', async () => {
    prismaMock.agendamento.findFirst.mockResolvedValue(exame())
    const r = await enviarLaudo(CLINICA, 'u-clinica', AG, { buffer: PDF, nome: 'laudo.pdf' })

    expect(r.nome_arquivo).toBe('laudo.pdf')
    const { create, where } = prismaMock.laudoExame.upsert.mock.calls[0][0]
    expect(where).toEqual({ agendamentoId: AG })
    expect(create).toMatchObject({ agendamentoId: AG, tamanhoBytes: PDF.length, enviadoPor: 'u-clinica' })
    expect(avisoMock).toHaveBeenCalledWith('laudo', AG)
  })

  it('reenviar substitui e apaga o arquivo anterior', async () => {
    const antigo = chaveDoLaudo(CLINICA, AG)
    await salvarLaudo(antigo, PDF)
    prismaMock.agendamento.findFirst.mockResolvedValue(exame({ laudo: { caminho: antigo } }))
    await enviarLaudo(CLINICA, null, AG, { buffer: PDF, nome: '' })

    const assinada = await urlAssinadaDoLaudo(antigo)
    const q = new URL(assinada, 'http://x').searchParams
    expect(await lerLaudoLocal(q.get('k')!, Number(q.get('e')), q.get('s')!)).toBeNull()
  })

  it.each([
    ['agendamento de outra clínica', null, { buffer: PDF, nome: 'a.pdf' }, 404],
    ['exame cancelado', exame({ status: 'cancelado' }), { buffer: PDF, nome: 'a.pdf' }, 400],
    ['ainda não marcado como realizado', exame({ status: 'confirmado' }), { buffer: PDF, nome: 'a.pdf' }, 400],
    ['sem arquivo', exame(), null, 400],
    ['não é PDF', exame(), { buffer: Buffer.from('MZ executável'), nome: 'a.pdf' }, 400],
    ['maior que 10 MB', exame(), { buffer: Buffer.alloc(TAMANHO_MAXIMO_LAUDO + 1), nome: 'a.pdf' }, 400],
  ])('%s: recusa sem gravar', async (_, agendamento, arquivo, status) => {
    prismaMock.agendamento.findFirst.mockResolvedValue(agendamento)
    await expect(enviarLaudo(CLINICA, 'u', AG, arquivo)).rejects.toMatchObject({ status })
    expect(prismaMock.laudoExame.upsert).not.toHaveBeenCalled()
  })

  it('falha ao gravar no banco apaga o arquivo recém-enviado', async () => {
    prismaMock.agendamento.findFirst.mockResolvedValue(exame())
    prismaMock.laudoExame.upsert.mockRejectedValue(new Error('db down'))
    await expect(enviarLaudo(CLINICA, 'u', AG, { buffer: PDF, nome: 'a.pdf' })).rejects.toThrow('db down')
    expect(avisoMock).not.toHaveBeenCalled()
  })
})

describe('urlDoLaudo', () => {
  it('quem vê o prontuário recebe URL assinada que abre o PDF', async () => {
    const caminho = chaveDoLaudo(CLINICA, AG)
    await salvarLaudo(caminho, PDF)
    prismaMock.agendamento.findFirst.mockResolvedValue({ petId: 'p1', laudo: { caminho } })
    acessoMock.mockResolvedValue({})

    const { url } = await urlDoLaudo(tutor, AG)
    const q = new URL(url, 'http://x').searchParams
    expect(await lerLaudoLocal(q.get('k')!, Number(q.get('e')), q.get('s')!)).toEqual(PDF)
    expect(acessoMock).toHaveBeenCalledWith(tutor, 'p1')
  })

  it('outro tutor: 403', async () => {
    prismaMock.agendamento.findFirst.mockResolvedValue({ petId: 'p1', laudo: { caminho: 'x' } })
    acessoMock.mockRejectedValue(new HttpError(404, { message: 'Prontuário não encontrado' }))
    await expect(urlDoLaudo(tutor, AG)).rejects.toMatchObject({ status: 403 })
  })

  it('outros erros de acesso sobem como vieram', async () => {
    prismaMock.agendamento.findFirst.mockResolvedValue({ petId: 'p1', laudo: null })
    acessoMock.mockRejectedValue(new Error('db down'))
    await expect(urlDoLaudo(tutor, AG)).rejects.toThrow('db down')
  })

  it('sem agendamento ou sem laudo: 404', async () => {
    prismaMock.agendamento.findFirst.mockResolvedValueOnce(null)
    await expect(urlDoLaudo(tutor, AG)).rejects.toMatchObject({ status: 404 })
    prismaMock.agendamento.findFirst.mockResolvedValueOnce({ petId: 'p1', laudo: null })
    acessoMock.mockResolvedValue({})
    await expect(urlDoLaudo(tutor, AG)).rejects.toMatchObject({ status: 404 })
  })
})

describe('driver local', () => {
  it('assinatura errada, expirada ou chave fora do padrão: null', async () => {
    const caminho = chaveDoLaudo(CLINICA, AG)
    await salvarLaudo(caminho, PDF)
    const q = new URL(await urlAssinadaDoLaudo(caminho), 'http://x').searchParams
    const e = Number(q.get('e'))
    expect(await lerLaudoLocal(caminho, e, 'f'.repeat(64))).toBeNull()
    expect(await lerLaudoLocal(caminho, e, 'curta')).toBeNull()
    expect(await lerLaudoLocal(caminho, Date.now() / 1000 - 1, q.get('s')!)).toBeNull()
    expect(await lerLaudoLocal('../../etc/passwd', e, q.get('s')!)).toBeNull()
  })

  it('nunca em produção e exige o segredo', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    await expect(salvarLaudo(chaveDoLaudo(CLINICA, AG), PDF)).rejects.toThrow(/produção/)
    vi.stubEnv('NODE_ENV', 'test')
    vi.stubEnv('LAUDOS_STORAGE_SECRET', '')
    await expect(urlAssinadaDoLaudo(chaveDoLaudo(CLINICA, AG))).rejects.toThrow(/LAUDOS_STORAGE_SECRET/)
  })

  it('chave inválida é recusada; remover chave inválida não faz nada', async () => {
    await expect(salvarLaudo('pets/x.pdf', PDF)).rejects.toThrow(/inválida/)
    await expect(urlAssinadaDoLaudo('pets/x.pdf')).rejects.toThrow(/inválida/)
    await expect(removerLaudo('pets/x.pdf')).resolves.toBeUndefined()
  })
})

describe('driver Supabase (bucket privado)', () => {
  beforeEach(() => {
    vi.stubEnv('LAUDOS_STORAGE_DIR', '')
    vi.stubEnv('SUPABASE_URL', 'https://proj.supabase.co/')
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'chave-servico')
  })

  it('upload como application/pdf sem upsert, no bucket lincepet-laudos', async () => {
    fetchMock.mockResolvedValue(new Response('{}', { status: 200 }))
    const key = chaveDoLaudo(CLINICA, AG)
    await salvarLaudo(key, PDF)
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe(`https://proj.supabase.co/storage/v1/object/lincepet-laudos/${key}`)
    expect(init.headers).toMatchObject({ 'Content-Type': 'application/pdf', 'x-upsert': 'false' })
  })

  it('URL assinada de 60 s', async () => {
    fetchMock.mockResolvedValue(Response.json({ signedURL: '/object/sign/lincepet-laudos/k?token=t' }))
    const key = chaveDoLaudo(CLINICA, AG)
    expect(await urlAssinadaDoLaudo(key)).toBe('https://proj.supabase.co/storage/v1/object/sign/lincepet-laudos/k?token=t')
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe(`https://proj.supabase.co/storage/v1/object/sign/lincepet-laudos/${key}`)
    expect(JSON.parse(init.body)).toEqual({ expiresIn: 60 })
  })

  it('bucket configurável e erros do storage viram exceção com log', async () => {
    vi.stubEnv('SUPABASE_LAUDOS_BUCKET', 'outro')
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    fetchMock.mockResolvedValue(new Response('erro', { status: 500 }))
    const key = chaveDoLaudo(CLINICA, AG)
    await expect(salvarLaudo(key, PDF)).rejects.toThrow(/HTTP 500/)
    expect(fetchMock.mock.calls[0][0]).toContain('/object/outro/')
    await expect(urlAssinadaDoLaudo(key)).rejects.toThrow(/HTTP 500/)
    log.mockRestore()
  })

  it('remover usa DELETE e nunca lança', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 200 }))
    const key = chaveDoLaudo(CLINICA, AG)
    await removerLaudo(key)
    expect(fetchMock.mock.calls[0][1].method).toBe('DELETE')
    fetchMock.mockRejectedValueOnce(new Error('rede'))
    await expect(removerLaudo(key)).resolves.toBeUndefined()
    log.mockRestore()
  })

  it('sem configuração do Supabase: erro claro', async () => {
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', '')
    await expect(salvarLaudo(chaveDoLaudo(CLINICA, AG), PDF)).rejects.toThrow(/não configurado/)
  })
})
