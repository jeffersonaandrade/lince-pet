import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const prismaMock = vi.hoisted(() => ({
  pushInscricao: { findMany: vi.fn(), deleteMany: vi.fn(), upsert: vi.fn() },
}))
vi.mock('@/server/db', () => ({ prisma: prismaMock }))

const enviarMock = vi.hoisted(() => vi.fn())
vi.mock('web-push', () => ({ default: { sendNotification: enviarMock } }))

import {
  chavePublicaVapid,
  enviarPush,
  inscricaoValida,
  removerInscricao,
  salvarInscricao,
} from '@/server/services/push'

const aviso = { titulo: 'Consulta agendada', mensagem: 'Amanhã às 14:00', url: '/dashboard/tutor' }
const aparelho = (id: string) => ({ id, endpoint: `https://push.exemplo/${id}`, p256dh: 'p', auth: 'a' })
const erroHttp = (statusCode: number) => Object.assign(new Error('push'), { statusCode })

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubEnv('VAPID_PUBLIC_KEY', 'pub')
  vi.stubEnv('VAPID_PRIVATE_KEY', 'priv')
  vi.stubEnv('VAPID_SUBJECT', 'mailto:teste@lincepet.com')
  prismaMock.pushInscricao.findMany.mockResolvedValue([aparelho('1'), aparelho('2')])
  enviarMock.mockResolvedValue({ statusCode: 201 })
})

afterEach(() => vi.unstubAllEnvs())

describe('enviarPush', () => {
  it('envia para todos os aparelhos do usuário com título, mensagem e link', async () => {
    const resumo = await enviarPush('u-1', aviso)

    expect(prismaMock.pushInscricao.findMany).toHaveBeenCalledWith({ where: { userId: 'u-1' } })
    expect(enviarMock).toHaveBeenCalledTimes(2)
    const [inscricao, corpo, opcoes] = enviarMock.mock.calls[0]
    expect(inscricao).toEqual({ endpoint: 'https://push.exemplo/1', keys: { p256dh: 'p', auth: 'a' } })
    expect(JSON.parse(corpo)).toEqual({ title: 'Consulta agendada', body: 'Amanhã às 14:00', url: '/dashboard/tutor' })
    expect(opcoes.vapidDetails).toEqual({ subject: 'mailto:teste@lincepet.com', publicKey: 'pub', privateKey: 'priv' })
    expect(resumo).toEqual({ enviados: 2, removidos: 0 })
  })

  it('apaga a inscrição que o navegador descartou (410 e 404) e mantém as outras', async () => {
    enviarMock.mockRejectedValueOnce(erroHttp(410)).mockRejectedValueOnce(erroHttp(404))
    prismaMock.pushInscricao.findMany.mockResolvedValue([aparelho('1'), aparelho('2'), aparelho('3')])

    const resumo = await enviarPush('u-1', aviso)

    expect(resumo).toEqual({ enviados: 1, removidos: 2 })
    expect(prismaMock.pushInscricao.deleteMany).toHaveBeenCalledTimes(2)
  })

  it('outra falha não apaga a inscrição nem lança', async () => {
    const erro = vi.spyOn(console, 'error').mockImplementation(() => {})
    enviarMock.mockRejectedValue(erroHttp(500))

    await expect(enviarPush('u-1', aviso)).resolves.toEqual({ enviados: 0, removidos: 0 })
    expect(prismaMock.pushInscricao.deleteMany).not.toHaveBeenCalled()
    erro.mockRestore()
  })

  it('falha ao ler as inscrições não derruba quem chamou', async () => {
    const erro = vi.spyOn(console, 'error').mockImplementation(() => {})
    prismaMock.pushInscricao.findMany.mockRejectedValue(new Error('db down'))

    await expect(enviarPush('u-1', aviso)).resolves.toEqual({ enviados: 0, removidos: 0 })
    erro.mockRestore()
  })

  it('sem chaves VAPID não faz nada', async () => {
    vi.stubEnv('VAPID_PRIVATE_KEY', '')

    await expect(enviarPush('u-1', aviso)).resolves.toEqual({ enviados: 0, removidos: 0 })
    expect(prismaMock.pushInscricao.findMany).not.toHaveBeenCalled()
    expect(enviarMock).not.toHaveBeenCalled()
  })

  it('sem VAPID_SUBJECT usa o e-mail padrão', async () => {
    vi.stubEnv('VAPID_SUBJECT', '')
    await enviarPush('u-1', aviso)
    expect(enviarMock.mock.calls[0][2].vapidDetails.subject).toBe('mailto:contato@lincepet.com')
  })
})

describe('inscrição do aparelho', () => {
  const valida = { endpoint: 'https://fcm.googleapis.com/x', keys: { p256dh: 'p', auth: 'a' } }

  it('valida endpoint https e chaves', () => {
    expect(inscricaoValida(valida)).toBe(true)
    expect(inscricaoValida({ ...valida, endpoint: 'http://inseguro' })).toBe(false)
    expect(inscricaoValida({ ...valida, endpoint: `https://${'x'.repeat(2000)}` })).toBe(false)
    expect(inscricaoValida({ endpoint: valida.endpoint })).toBe(false)
    expect(inscricaoValida({ ...valida, keys: { p256dh: 'p'.repeat(300), auth: 'a' } })).toBe(false)
    expect(inscricaoValida(null)).toBe(false)
  })

  it('salva por endpoint (o aparelho troca de dono se outro usuário entrar nele)', async () => {
    await salvarInscricao('u-1', valida, 'Chrome')

    const { where, create, update } = prismaMock.pushInscricao.upsert.mock.calls[0][0]
    expect(where).toEqual({ endpoint: valida.endpoint })
    expect(create).toMatchObject({ endpoint: valida.endpoint, userId: 'u-1', p256dh: 'p', auth: 'a', userAgent: 'Chrome' })
    expect(create.id).toEqual(expect.any(String))
    expect(update).toMatchObject({ userId: 'u-1', userAgent: 'Chrome' })
  })

  it('sem user agent grava null', async () => {
    await salvarInscricao('u-1', valida)
    expect(prismaMock.pushInscricao.upsert.mock.calls[0][0].create.userAgent).toBeNull()
  })

  it('remove só o aparelho do próprio usuário', async () => {
    await removerInscricao('u-1', valida.endpoint)
    expect(prismaMock.pushInscricao.deleteMany).toHaveBeenCalledWith({ where: { userId: 'u-1', endpoint: valida.endpoint } })
  })

  it('chave pública vem do ambiente; null quando não configurada', () => {
    expect(chavePublicaVapid()).toBe('pub')
    vi.stubEnv('VAPID_PUBLIC_KEY', '')
    expect(chavePublicaVapid()).toBeNull()
  })
})
