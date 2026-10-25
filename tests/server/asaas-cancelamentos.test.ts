import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import axios from 'axios'

const db = vi.hoisted(() => {
  const m = {
    $executeRaw: vi.fn(),
    asaasCancelamento: { findMany: vi.fn(), findUnique: vi.fn(), findUniqueOrThrow: vi.fn(), updateMany: vi.fn(), upsert: vi.fn() },
    subscription: { findUniqueOrThrow: vi.fn(), update: vi.fn(), count: vi.fn() },
    veterinario: { update: vi.fn() }, clinica: { update: vi.fn() }, prestador: { update: vi.fn() },
  }
  return Object.assign(m, { $transaction: vi.fn(async (fn: (tx: typeof m) => unknown) => fn(m)) })
})
vi.mock('@/server/db', () => ({ prisma: db }))
import { conciliarCancelamentos, confirmarCancelamento, solicitarCancelamento } from '@/server/services/asaas-cancelamentos'

const remote = { getSubscription: vi.fn(), cancelSubscription: vi.fn() }
const factory = vi.fn(() => remote as never)
const sub = { id: 's-1', veterinarioId: 'v-1', clinicaId: null, prestadorId: null, status: 'active', asaasSubscriptionId: 'sub_1', canceledAt: null }

beforeEach(() => {
  vi.resetAllMocks()
  vi.spyOn(console, 'error').mockImplementation(() => {})
  db.$transaction.mockImplementation(async fn => fn(db))
  factory.mockReturnValue(remote as never)
  db.asaasCancelamento.findMany.mockResolvedValue([{ subscriptionId: sub.id }])
  db.asaasCancelamento.updateMany.mockResolvedValue({ count: 1 })
  db.asaasCancelamento.findUniqueOrThrow.mockResolvedValue({ subscription: sub })
  db.asaasCancelamento.findUnique.mockResolvedValue({ tentativas: 1 })
  db.subscription.findUniqueOrThrow.mockResolvedValue(sub)
  db.subscription.count.mockResolvedValue(0)
  remote.getSubscription.mockResolvedValue({ id: 'sub_1', deleted: false })
  remote.cancelSubscription.mockResolvedValue({ id: 'sub_1', deleted: true })
})
afterEach(() => vi.restoreAllMocks())

describe('cancelamento confirmado pelo provedor', () => {
  it('cron sem factory injetada usa o cliente configurado e confirma o DELETE; HTTP permanece simulado', async () => {
    vi.stubEnv('ASAAS_ENV', 'sandbox')
    vi.stubEnv('ASAAS_API_KEY_SANDBOX', 'chave-ficticia-unitaria')
    const http = { get: vi.fn().mockResolvedValue({ data: { id: 'sub_1', deleted: false } }), delete: vi.fn().mockResolvedValue({ data: { id: 'sub_1', deleted: true } }) }
    vi.spyOn(axios, 'create').mockReturnValue(http as never)
    try {
      expect(await conciliarCancelamentos()).toEqual({ confirmados: 1, pendentes: 0 })
      expect(http.get).toHaveBeenCalledWith('/subscriptions/sub_1')
      expect(http.delete).toHaveBeenCalledWith('/subscriptions/sub_1')
    } finally { vi.unstubAllEnvs() }
  })
  it('confirma antes de alterar status e encerra a fila atomicamente', async () => {
    expect(await conciliarCancelamentos(factory)).toEqual({ confirmados: 1, pendentes: 0 })
    expect(remote.cancelSubscription).toHaveBeenCalledWith('sub_1')
    expect(remote.cancelSubscription.mock.invocationCallOrder[0]).toBeLessThan(db.$transaction.mock.invocationCallOrder[0])
    expect(db.subscription.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: 'canceled' }) }))
    expect(db.asaasCancelamento.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ concluidoEm: expect.any(Date), ultimoErro: null }) }))
    expect(db.veterinario.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ subscriptionPlanCode: 'none' }) }))
    expect(db.veterinario.update.mock.calls[0][0].data).not.toHaveProperty('monthlyAppointmentsUsed')
  })
  it('reconcilia DELETE já aceito cuja resposta se perdeu, sem novo DELETE', async () => {
    remote.getSubscription.mockResolvedValue({ id: 'sub_1', deleted: true })
    expect(await conciliarCancelamentos(factory)).toEqual({ confirmados: 1, pendentes: 0 })
    expect(remote.cancelSubscription).not.toHaveBeenCalled()
  })
  it('não rebaixa o plano novo quando ainda existe outra assinatura ativa', async () => {
    db.subscription.count.mockResolvedValue(1)
    await conciliarCancelamentos(factory)
    expect(db.veterinario.update).not.toHaveBeenCalled()
  })
  it.each([['clinica', 'none'], ['prestador', 'free']])('restaura o padrão de %s sem zerar uso', async (tipo, padrao) => {
    const owner = { ...sub, veterinarioId: null, clinicaId: tipo === 'clinica' ? 'c1' : null, prestadorId: tipo === 'prestador' ? 'p1' : null }
    await confirmarCancelamento(db as never, owner as never)
    const calls = tipo === 'clinica' ? db.clinica.update : db.prestador.update
    expect(calls.mock.calls[0][0].data).toMatchObject({ subscriptionPlanCode: padrao })
    expect(calls.mock.calls[0][0].data).not.toHaveProperty('monthlyAppointmentsUsed')
  })
  it('assinatura gratuita não instancia cliente do Asaas', async () => {
    db.asaasCancelamento.findUniqueOrThrow.mockResolvedValue({ subscription: { ...sub, asaasSubscriptionId: null } })
    await conciliarCancelamentos(factory)
    expect(factory).not.toHaveBeenCalled()
    expect(db.subscription.update).toHaveBeenCalled()
  })
})

describe('falha, retentativa e concorrência', () => {
  it.each([401, 404, 429, 500])('HTTP %i mantém o estado local, grava backoff e descarta segredo', async status => {
    const secret = 'CANARY-ASAAS-SECRET'
    remote.getSubscription.mockRejectedValue({ response: { status, data: secret }, config: { headers: { access_token: secret } } })
    const now = Date.now()
    expect(await conciliarCancelamentos(factory)).toEqual({ confirmados: 0, pendentes: 1 })
    expect(db.subscription.update).not.toHaveBeenCalled()
    expect(db.veterinario.update).not.toHaveBeenCalled()
    const retry = db.asaasCancelamento.updateMany.mock.calls.at(-1)![0]
    expect(retry.where).toMatchObject({ concluidoEm: null, bloqueadoAte: expect.any(Date) })
    expect(retry.data).toMatchObject({ bloqueadoAte: null, ultimoErro: `HTTP_${status}` })
    expect(retry.data.proximaTentativaEm.getTime()).toBeGreaterThanOrEqual(now + 60_000)
    expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toContain(secret)
  })
  it.each([{}, { deleted: false }, { id: 'outra', deleted: true }])('DELETE sem confirmação correta mantém pendência: %j', async result => {
    remote.cancelSubscription.mockResolvedValue(result)
    expect((await conciliarCancelamentos(factory)).pendentes).toBe(1)
    expect(db.subscription.update).not.toHaveBeenCalled()
  })
  it('GET de outra assinatura nunca serve como confirmação', async () => {
    remote.getSubscription.mockResolvedValue({ id: 'outra', deleted: true })
    expect((await conciliarCancelamentos(factory)).pendentes).toBe(1)
    expect(db.subscription.update).not.toHaveBeenCalled()
  })
  it('timeout mantém solicitação para conciliar depois', async () => {
    remote.cancelSubscription.mockRejectedValue({ code: 'ECONNABORTED' })
    expect((await conciliarCancelamentos(factory)).pendentes).toBe(1)
    expect(db.asaasCancelamento.updateMany.mock.calls.at(-1)![0].data.ultimoErro).toBe('TIMEOUT')
    expect(db.subscription.update).not.toHaveBeenCalled()
  })
  it('outro worker com lease vigente impede segunda chamada externa', async () => {
    db.asaasCancelamento.updateMany.mockResolvedValueOnce({ count: 0 })
    expect(await conciliarCancelamentos(factory)).toEqual({ confirmados: 0, pendentes: 0 })
    expect(factory).not.toHaveBeenCalled()
  })
  it('pedido repetido não reinicia backoff, nem apaga conclusão', async () => {
    await solicitarCancelamento(db as never, sub as never, 'usuario')
    expect(db.asaasCancelamento.upsert).toHaveBeenCalledWith({ where: { subscriptionId: 's-1' }, create: { subscriptionId: 's-1', motivo: 'usuario' }, update: { motivo: 'usuario' } })
    await solicitarCancelamento(db as never, sub as never, 'troca')
    expect(db.asaasCancelamento.upsert.mock.calls.at(-1)![0].update).toEqual({})
  })
})
