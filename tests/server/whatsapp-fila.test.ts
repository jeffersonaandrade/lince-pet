import { describe, it, expect, vi, beforeEach } from 'vitest'
import { DateTime } from 'luxon'

const prismaMock = vi.hoisted(() => ({
  whatsappEnvio: { findMany: vi.fn(), updateMany: vi.fn(), update: vi.fn() },
}))
vi.mock('@/server/db', () => ({ prisma: prismaMock }))

const providerMock = vi.hoisted(() => ({
  nome: 'gateway',
  assincrono: true,
  enviar: vi.fn(),
  consultar: vi.fn(),
}))
vi.mock('@/server/services/whatsapp', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/server/services/whatsapp')>()
  return {
    ...original,
    providerAtual: () => providerMock,
    enviarComRetry: (...[p, to, texto, opts]: Parameters<typeof original.enviarComRetry>) =>
      original.enviarComRetry(p, to, texto, { ...opts, esperaMs: 0 }),
  }
})

import { LIMITE_TENTATIVAS, avisoAindaValido, conciliarEnvios } from '@/server/services/whatsapp-fila'

const AGORA = DateTime.fromISO('2026-10-10T08:00', { zone: 'America/Sao_Paulo' })
const ATUALIZADO = new Date('2026-10-10T10:00:00Z')

function envio(over: Record<string, unknown> = {}) {
  return {
    id: 'e1',
    evento: 'confirmacao',
    referencia: '2026-10-10 14:00',
    telefone: '5581999990000',
    mensagem: 'Consulta confirmada',
    status: 'aceito',
    tentativas: 1,
    provider: 'gateway',
    providerMessageId: 'job-1',
    updatedAt: ATUALIZADO,
    agendamento: { status: 'confirmado', dataConsulta: '2026-10-10', horarioConsulta: '14:00' },
    ...over,
  }
}

const dadosMarcados = () => prismaMock.whatsappEnvio.updateMany.mock.calls.map((c) => c[0].data)
const dadosEntregues = () => prismaMock.whatsappEnvio.update.mock.calls.map((c) => c[0].data)

beforeEach(() => {
  vi.clearAllMocks()
  vi.spyOn(console, 'error').mockImplementation(() => {})
  prismaMock.whatsappEnvio.updateMany.mockResolvedValue({ count: 1 })
  prismaMock.whatsappEnvio.update.mockResolvedValue({})
  providerMock.enviar.mockResolvedValue({ id: 'job-2' })
})

describe('avisoAindaValido', () => {
  const valido = (over: Record<string, unknown> = {}) => avisoAindaValido(envio(over) as never, AGORA)

  it('consulta futura, ativa e na mesma data/hora: vale', () => {
    expect(valido()).toBe(true)
  })

  it('consulta já passou, sem agendamento ou sem horário: não vale', () => {
    expect(valido({ agendamento: { status: 'confirmado', dataConsulta: '2026-10-10', horarioConsulta: '07:00' } })).toBe(false)
    expect(valido({ agendamento: null })).toBe(false)
    expect(valido({ agendamento: { status: 'confirmado', dataConsulta: '2026-10-10', horarioConsulta: null } })).toBe(false)
  })

  it('consulta remarcada ou cancelada depois do aviso: não vale', () => {
    expect(valido({ referencia: '2026-10-09 14:00' })).toBe(false)
    expect(valido({ agendamento: { status: 'cancelado', dataConsulta: '2026-10-10', horarioConsulta: '14:00' } })).toBe(false)
  })

  it('cancelamento continua valendo com a consulta cancelada', () => {
    expect(
      valido({ evento: 'cancelamento', referencia: 'x', agendamento: { status: 'cancelado', dataConsulta: '2026-10-10', horarioConsulta: '14:00' } })
    ).toBe(true)
  })

  it('lembrete 24h não sai a 2h ou menos da consulta', () => {
    expect(valido({ evento: 'lembrete_24h', referencia: '2026-10-10 09:30', agendamento: { status: 'confirmado', dataConsulta: '2026-10-10', horarioConsulta: '09:30' } })).toBe(false)
    expect(valido({ evento: 'lembrete_24h' })).toBe(true)
  })
})

describe('conciliarEnvios', () => {
  it('busca aceitos e processandos parados e falhas temporárias, mais antigos primeiro', async () => {
    prismaMock.whatsappEnvio.findMany.mockResolvedValue([])
    await conciliarEnvios(AGORA)
    const args = prismaMock.whatsappEnvio.findMany.mock.calls[0][0]
    expect(args.where.OR).toEqual([
      { status: 'aceito', updatedAt: { lt: AGORA.minus({ minutes: 2 }).toJSDate() } },
      { status: 'processando', updatedAt: { lt: AGORA.minus({ minutes: 5 }).toJSDate() } },
      { status: 'falhou', motivo: 'erro_temporario' },
    ])
    expect(args.orderBy).toEqual({ updatedAt: 'asc' })
    expect(args.take).toBe(50)
  })

  it('aceito ainda na fila do gateway fica como está', async () => {
    prismaMock.whatsappEnvio.findMany.mockResolvedValue([envio()])
    providerMock.consultar.mockResolvedValue('pendente')
    expect(await conciliarEnvios(AGORA)).toMatchObject({ conferidas: 1, confirmadas: 0, reenviadas: 0 })
    expect(prismaMock.whatsappEnvio.updateMany).not.toHaveBeenCalled()
  })

  it('aceito confirmado pelo gateway vira enviado, só se a linha não mudou', async () => {
    prismaMock.whatsappEnvio.findMany.mockResolvedValue([envio()])
    providerMock.consultar.mockResolvedValue('enviada')
    expect(await conciliarEnvios(AGORA)).toMatchObject({ conferidas: 1, confirmadas: 1 })
    expect(providerMock.consultar).toHaveBeenCalledWith('job-1')
    const chamada = prismaMock.whatsappEnvio.updateMany.mock.calls[0][0]
    expect(chamada.where).toEqual({ id: 'e1', status: 'aceito', updatedAt: ATUALIZADO })
    expect(chamada.data).toMatchObject({ status: 'enviado' })
  })

  it('gateway falhou: marca falha temporária para a próxima rodada reenviar', async () => {
    prismaMock.whatsappEnvio.findMany.mockResolvedValue([envio()])
    providerMock.consultar.mockResolvedValue('falhou')
    expect(await conciliarEnvios(AGORA)).toMatchObject({ falhas: 1 })
    expect(dadosMarcados()[0]).toMatchObject({ status: 'falhou', motivo: 'erro_temporario' })
    expect(providerMock.enviar).not.toHaveBeenCalled()
  })

  it('gateway perdeu a mensagem: reenvia o mesmo texto com nova chave e volta a aceito', async () => {
    prismaMock.whatsappEnvio.findMany.mockResolvedValue([envio()])
    providerMock.consultar.mockResolvedValue('desconhecido')
    expect(await conciliarEnvios(AGORA)).toMatchObject({ conferidas: 1, reenviadas: 1 })
    expect(dadosMarcados()[0]).toMatchObject({ status: 'processando' })
    expect(providerMock.enviar).toHaveBeenCalledWith('5581999990000', 'Consulta confirmada', { idempotencyKey: 'e1:2' })
    expect(dadosEntregues()[0]).toMatchObject({ status: 'aceito', tentativas: 2, providerMessageId: 'job-2', motivo: null, erro: null })
  })

  it('processando parado e falha temporária são reenviados', async () => {
    prismaMock.whatsappEnvio.findMany.mockResolvedValue([
      envio({ id: 'p', status: 'processando', providerMessageId: null, tentativas: 0 }),
      envio({ id: 'f', status: 'falhou', tentativas: 2 }),
    ])
    expect(await conciliarEnvios(AGORA)).toMatchObject({ reenviadas: 2 })
    expect(providerMock.consultar).not.toHaveBeenCalled()
    expect(providerMock.enviar.mock.calls.map((c) => c[2])).toEqual([{ idempotencyKey: 'p:1' }, { idempotencyKey: 'f:3' }])
  })

  it('reenvio que falha de novo conta como falha', async () => {
    prismaMock.whatsappEnvio.findMany.mockResolvedValue([envio({ status: 'falhou' })])
    providerMock.enviar.mockRejectedValue({ response: { status: 503 } })
    expect(await conciliarEnvios(AGORA)).toMatchObject({ falhas: 1 })
    expect(dadosEntregues()[0]).toMatchObject({ status: 'falhou', motivo: 'erro_temporario' })
  })

  it('no limite de tentativas não reenvia', async () => {
    prismaMock.whatsappEnvio.findMany.mockResolvedValue([envio({ status: 'falhou', tentativas: LIMITE_TENTATIVAS })])
    expect(await conciliarEnvios(AGORA)).toMatchObject({ falhas: 1 })
    expect(dadosMarcados()[0]).toMatchObject({ status: 'falhou', motivo: 'limite_tentativas' })
    expect(providerMock.enviar).not.toHaveBeenCalled()
  })

  it('aviso que perdeu o sentido expira sem reenviar', async () => {
    prismaMock.whatsappEnvio.findMany.mockResolvedValue([envio({ status: 'falhou', referencia: '2026-10-09 14:00' })])
    expect(await conciliarEnvios(AGORA)).toMatchObject({ expiradas: 1 })
    expect(dadosMarcados()[0]).toMatchObject({ status: 'falhou', motivo: 'expirado' })
    expect(providerMock.enviar).not.toHaveBeenCalled()
  })

  it('sem texto guardado (linha antiga) marca erro', async () => {
    prismaMock.whatsappEnvio.findMany.mockResolvedValue([envio({ status: 'processando', mensagem: null })])
    expect(await conciliarEnvios(AGORA)).toMatchObject({ falhas: 1 })
    expect(dadosMarcados()[0]).toMatchObject({ status: 'falhou', motivo: 'erro' })
  })

  it('linha pega por outra execução não é reenviada', async () => {
    prismaMock.whatsappEnvio.findMany.mockResolvedValue([envio({ status: 'falhou' })])
    prismaMock.whatsappEnvio.updateMany.mockResolvedValue({ count: 0 })
    expect(await conciliarEnvios(AGORA)).toMatchObject({ reenviadas: 0, falhas: 0 })
    expect(providerMock.enviar).not.toHaveBeenCalled()
  })

  it('aceito de outro provedor não é consultado nem reenviado', async () => {
    prismaMock.whatsappEnvio.findMany.mockResolvedValue([envio({ provider: 'outro' })])
    expect(await conciliarEnvios(AGORA)).toMatchObject({ conferidas: 0, reenviadas: 0 })
    expect(providerMock.consultar).not.toHaveBeenCalled()
    expect(providerMock.enviar).not.toHaveBeenCalled()
  })

  it('erro numa linha é registrado e não para as outras', async () => {
    prismaMock.whatsappEnvio.findMany.mockResolvedValue([envio({ id: 'a' }), envio({ id: 'b' })])
    providerMock.consultar.mockRejectedValueOnce(new Error('gateway fora')).mockResolvedValueOnce('enviada')
    expect(await conciliarEnvios(AGORA)).toMatchObject({ conferidas: 2, confirmadas: 1 })
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining('envio a'), expect.any(Error))
  })
})
