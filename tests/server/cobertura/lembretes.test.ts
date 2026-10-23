import { describe, it, expect, vi, beforeEach } from 'vitest'
import { DateTime } from 'luxon'
import { Prisma } from '@/generated/prisma/client'

const prismaMock = vi.hoisted(() => ({
  agendamento: { findUnique: vi.fn(), findMany: vi.fn() },
  avisoLembrete: { create: vi.fn() },
}))
vi.mock('@/server/db', () => ({ prisma: prismaMock }))

const sinoMock = vi.hoisted(() => vi.fn())
vi.mock('@/server/services/in-app-notifications', () => ({
  inAppNotifications: { notifyAppointmentReminderToTutor: sinoMock },
}))

const emailMock = vi.hoisted(() => vi.fn())
vi.mock('@/server/services/notifications', () => ({ notifications: { sendLembreteConsulta: emailMock } }))

const whatsappMock = vi.hoisted(() => vi.fn())
vi.mock('@/server/services/whatsapp-notificacoes', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/server/services/whatsapp-notificacoes')>()),
  notificarAgendamento: whatsappMock,
}))

import { avisarLembrete, processarLembretes } from '@/server/services/whatsapp-lembretes'
import { inicioDaConsulta } from '@/server/services/agendamentos'
import { lembreteConsultaEmail } from '@/server/emails/lembrete_consulta'
import type { AgendamentoWhatsapp } from '@/server/services/whatsapp-notificacoes'

const tutorUser = { id: 'u-tutor', nome: 'Ana', sobrenome: 'Lima', email: 'ana@exemplo.com', notificarEmail: 1 }

function agendamento(over: Record<string, unknown> = {}) {
  return {
    id: 'ag-1',
    dataConsulta: '2026-10-10',
    horarioConsulta: '14:00',
    localNome: 'Clínica Centro',
    localEndereco: null,
    tipoConsulta: 'presencial',
    createdAt: new Date('2026-10-01T12:00:00Z'),
    tutor: { id: 't1', user: tutorUser },
    pet: { nome: 'Rex' },
    veterinario: { id: 'v1', subscriptionPlanCode: 'free', user: { nome: 'João', sobrenome: 'Souza' } },
    prestador: null,
    clinica: null,
    ...over,
  } as unknown as AgendamentoWhatsapp
}

const duplicado = () => new Prisma.PrismaClientKnownRequestError('Unique constraint', { code: 'P2002', clientVersion: 'test' })
const horasAntes = (h: number) => inicioDaConsulta('2026-10-10', '14:00').minus({ hours: h }) as DateTime<true>

beforeEach(() => {
  vi.clearAllMocks()
  prismaMock.avisoLembrete.create.mockResolvedValue({})
  prismaMock.agendamento.findMany.mockResolvedValue([
    { id: 'ag-1', dataConsulta: '2026-10-10', horarioConsulta: '14:00', createdAt: new Date('2026-10-01T12:00:00Z') },
  ])
  prismaMock.agendamento.findUnique.mockResolvedValue(agendamento())
  whatsappMock.mockResolvedValue({ tutor: 'ignorado' })
  sinoMock.mockResolvedValue(undefined)
  emailMock.mockResolvedValue({ success: true })
})

describe('lembretes por todos os canais (sem plano)', () => {
  it('24h antes: sino e navegador para o tutor, e-mail da véspera e WhatsApp', async () => {
    const resumo = await processarLembretes(horasAntes(20))

    expect(resumo).toMatchObject({ processadas: 1, avisadas: 1, ignoradas: 1 })
    expect(prismaMock.avisoLembrete.create.mock.calls[0][0].data).toMatchObject({
      agendamentoId: 'ag-1',
      evento: 'lembrete_24h',
      referencia: '2026-10-10 14:00',
    })
    expect(sinoMock).toHaveBeenCalledWith({
      tutorUserId: 'u-tutor',
      veterinarioNome: 'João Souza',
      dataConsulta: '10/10/2026',
      horarioConsulta: '14:00',
      agendamentoId: 'ag-1',
      quando: 'amanha',
      petNome: 'Rex',
      exames: null,
      preparo: null,
    })
    expect(emailMock).toHaveBeenCalledWith('ana@exemplo.com', {
      nomeTutor: 'Ana',
      pet: 'Rex',
      profissional: 'João Souza',
      data: '10/10/2026',
      hora: '14:00',
      local: 'Clínica Centro',
      exames: null,
      preparo: null,
    })
    expect(whatsappMock).toHaveBeenCalledWith('lembrete_24h', expect.objectContaining({ id: 'ag-1' }), ['tutor'])
  })

  it('2h antes: sino e navegador, sem e-mail', async () => {
    await processarLembretes(horasAntes(1.5))

    expect(sinoMock).toHaveBeenCalledWith(expect.objectContaining({ quando: 'em_breve' }))
    expect(prismaMock.avisoLembrete.create.mock.calls[0][0].data.evento).toBe('lembrete_2h')
    expect(emailMock).not.toHaveBeenCalled()
  })

  it('respeita o e-mail desligado pelo tutor, mas mantém sino e navegador', async () => {
    prismaMock.agendamento.findUnique.mockResolvedValue(
      agendamento({ tutor: { id: 't1', user: { ...tutorUser, notificarEmail: 0 } } })
    )
    await processarLembretes(horasAntes(20))

    expect(sinoMock).toHaveBeenCalledTimes(1)
    expect(emailMock).not.toHaveBeenCalled()
  })

  it('rodar duas vezes não duplica o lembrete', async () => {
    await processarLembretes(horasAntes(20))
    prismaMock.avisoLembrete.create.mockRejectedValue(duplicado())
    const segunda = await processarLembretes(horasAntes(19.75))

    expect(segunda.avisadas).toBe(0)
    expect(sinoMock).toHaveBeenCalledTimes(1)
    expect(emailMock).toHaveBeenCalledTimes(1)
  })

  it('fora das janelas não avisa ninguém', async () => {
    const resumo = await processarLembretes(horasAntes(30))
    expect(resumo.processadas).toBe(0)
    expect(prismaMock.avisoLembrete.create).not.toHaveBeenCalled()
  })
})

describe('e-mail da véspera', () => {
  it('traz pet, profissional, data, hora e local, com HTML escapado', () => {
    const html = lembreteConsultaEmail({
      nomeTutor: 'Ana',
      pet: 'Rex <b>',
      profissional: 'João Souza',
      data: '10/10/2026',
      hora: '14:00',
      local: 'Clínica Centro',
      logoHtml: '<img alt="logo" />',
    })
    expect(html).toContain('Sua consulta é amanhã')
    expect(html).toContain('Olá, <strong>Ana</strong>!')
    expect(html).toContain('/dashboard/tutor#consultas')
    expect(html).toContain('Rex &lt;b&gt;')
    expect(html).not.toContain('Rex <b>')
    for (const v of ['João Souza', '10/10/2026', '14:00', 'Clínica Centro', '<img alt="logo" />']) expect(html).toContain(v)
  })
})

describe('avisarLembrete', () => {
  it('sem tutor com usuário não grava nada', async () => {
    await expect(avisarLembrete('lembrete_24h', agendamento({ tutor: null }))).resolves.toBe(false)
    expect(prismaMock.avisoLembrete.create).not.toHaveBeenCalled()
  })

  it('falha no sino não lança e não impede o WhatsApp', async () => {
    const erro = vi.spyOn(console, 'error').mockImplementation(() => {})
    sinoMock.mockRejectedValue(new Error('db down'))

    const resumo = await processarLembretes(horasAntes(20))

    expect(resumo.avisadas).toBe(0)
    expect(whatsappMock).toHaveBeenCalledTimes(1)
    erro.mockRestore()
  })

  it('erro inesperado ao gravar o lembrete não lança', async () => {
    const erro = vi.spyOn(console, 'error').mockImplementation(() => {})
    prismaMock.avisoLembrete.create.mockRejectedValue(new Error('db down'))

    await expect(avisarLembrete('lembrete_2h', agendamento())).resolves.toBe(false)
    expect(sinoMock).not.toHaveBeenCalled()
    erro.mockRestore()
  })
})

describe('lembrete de exame', () => {
  const exame = () =>
    agendamento({
      tipoConsulta: 'exame',
      veterinario: null,
      clinica: { nomeClinica: 'Clínica Centro' },
      exames: [
        { nome: 'Hemograma', preparo: 'Jejum de 8h' },
        { nome: 'Raio-X', preparo: null },
      ],
    })

  it('sino e e-mail falam de exame, com os exames, a clínica e o preparo', async () => {
    await avisarLembrete('lembrete_24h', exame())

    expect(sinoMock).toHaveBeenCalledWith(
      expect.objectContaining({ veterinarioNome: 'Clínica Centro', exames: 'Hemograma, Raio-X', preparo: 'Hemograma: Jejum de 8h' })
    )
    expect(emailMock).toHaveBeenCalledWith('ana@exemplo.com', expect.objectContaining({ exames: 'Hemograma, Raio-X', preparo: 'Hemograma: Jejum de 8h' }))
  })

  it('e-mail de exame troca o título e mostra o preparo', () => {
    const html = lembreteConsultaEmail({
      nomeTutor: 'Ana', pet: 'Rex', profissional: 'Clínica Centro', data: '10/10/2026', hora: '14:00', local: 'Rua A',
      exames: 'Hemograma', preparo: 'Hemograma: Jejum de 8h',
    })
    expect(html).toContain('Seu exame é amanhã')
    expect(html).toContain('Jejum de 8h')
    expect(html).toContain('Na clínica')
    expect(html).not.toContain('Sua consulta é amanhã')
  })
})
