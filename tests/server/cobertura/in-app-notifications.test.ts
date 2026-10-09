import { describe, it, expect, vi, beforeEach } from 'vitest'

const prismaMock = vi.hoisted(() => ({ notification: { create: vi.fn() } }))
vi.mock('@/server/db', () => ({ prisma: prismaMock }))

import { inAppNotifications } from '@/server/services/in-app-notifications'

const gravado = () => prismaMock.notification.create.mock.calls.at(-1)![0].data

beforeEach(() => {
  vi.clearAllMocks()
  prismaMock.notification.create.mockResolvedValue({})
})

const consulta = { tutorNome: 'Ana', dataConsulta: '10/10/2026', horarioConsulta: '14:00', agendamentoId: 'ag-1' }

describe('avisos in-app (sino)', () => {
  it('novo agendamento vai para o usuário do vet, não lido, com o id da consulta', async () => {
    await inAppNotifications.notifyNewAppointmentToVet({ ...consulta, veterinarioUserId: 'u-vet' })
    expect(gravado()).toMatchObject({
      userId: 'u-vet',
      type: 'NOVO_AGENDAMENTO',
      title: 'Nova consulta agendada!',
      message: 'Ana agendou uma consulta para 10/10/2026 às 14:00.',
      isRead: 0,
      actionData: { agendamentoId: 'ag-1' },
    })
    expect(gravado().id).toEqual(expect.any(String))
    expect(gravado().createdAt).toBeInstanceOf(Date)
  })

  it('cancelamento e reagendamento pelo tutor avisam o vet', async () => {
    await inAppNotifications.notifyAppointmentCancelledToVet({ ...consulta, veterinarioUserId: 'u-vet' })
    expect(gravado()).toMatchObject({ userId: 'u-vet', type: 'AGENDAMENTO_CANCELADO', message: expect.stringContaining('Ana cancelou') })

    await inAppNotifications.notifyAppointmentRescheduledToVet({ ...consulta, veterinarioUserId: 'u-vet' })
    expect(gravado()).toMatchObject({ type: 'AGENDAMENTO_REAGENDADO', message: 'Ana reagendou a consulta para 10/10/2026 às 14:00.' })
  })

  it('confirmação, bloqueio de agenda e conclusão avisam o tutor', async () => {
    const p = { tutorUserId: 'u-tutor', veterinarioNome: 'João', dataConsulta: '10/10/2026', horarioConsulta: '14:00', agendamentoId: 'ag-1' }
    await inAppNotifications.notifyAppointmentConfirmedToTutor(p)
    expect(gravado()).toMatchObject({ userId: 'u-tutor', type: 'AGENDAMENTO_CONFIRMADO', message: expect.stringContaining('Dr(a). João confirmou') })

    await inAppNotifications.notifyAppointmentCancelledByAgendaBlockToTutor(p)
    expect(gravado()).toMatchObject({
      type: 'AGENDAMENTO_CANCELADO',
      message: expect.stringContaining('bloqueou a agenda'),
      actionData: { agendamentoId: 'ag-1' },
    })

    await inAppNotifications.notifyAppointmentCompletedToTutor({ tutorUserId: 'u-tutor', veterinarioNome: 'João', agendamentoId: 'ag-1' })
    expect(gravado()).toMatchObject({ type: 'AGENDAMENTO_CONCLUIDO', actionData: { agendamentoId: 'ag-1', requestReview: true } })
  })

  it('avaliação mostra as estrelas para vet e clínica', async () => {
    await inAppNotifications.notifyNewReviewToVet({ veterinarioUserId: 'u-vet', tutorNome: 'Ana', estrelas: 4, agendamentoId: 'ag-1' })
    expect(gravado()).toMatchObject({
      userId: 'u-vet',
      type: 'AVALIACAO_RECEBIDA',
      message: 'Ana avaliou sua consulta: ★★★★☆ (4/5).',
      actionData: { agendamentoId: 'ag-1', estrelas: 4 },
    })

    await inAppNotifications.notifyNewReviewToClinica({ clinicaUserId: 'u-cli', tutorNome: 'Ana', estrelas: 5, agendamentoId: 'ag-1' })
    expect(gravado()).toMatchObject({ userId: 'u-cli', title: 'Nova avaliação da clínica!', message: expect.stringContaining('★★★★★ (5/5)') })
  })

  it('pedido de vínculo vai ao vet; resposta volta à clínica (aceita ou recusada)', async () => {
    await inAppNotifications.notifyClinicLinkRequest({ veterinarioUserId: 'u-vet', clinicaNome: 'Clínica X', clinicaId: 'cli-1' })
    expect(gravado()).toMatchObject({
      userId: 'u-vet',
      type: 'VINCULO_CLINICA_SOLICITADO',
      actionData: { clinicaId: 'cli-1', clinicaNome: 'Clínica X', isRequest: true },
    })

    await inAppNotifications.notifyClinicLinkResponse({ clinicaUserId: 'u-cli', veterinarioNome: 'João', aceito: true })
    expect(gravado()).toMatchObject({ title: 'Solicitação de vínculo aceita', message: 'O veterinário João aceitou seu pedido de vínculo.' })

    await inAppNotifications.notifyClinicLinkResponse({ clinicaUserId: 'u-cli', veterinarioNome: 'João', aceito: false })
    expect(gravado()).toMatchObject({ title: 'Solicitação de vínculo recusada', actionData: { aceito: false } })
  })

  it('aviso genérico sem actionData não grava actionData', async () => {
    await inAppNotifications.createGenericNotification({ userId: 'u-1', type: 'X', title: 't', message: 'm' })
    expect(gravado()).toMatchObject({ userId: 'u-1', type: 'X', title: 't', message: 'm', isRead: 0 })
    expect(gravado().actionData).toBeUndefined()

    await inAppNotifications.createGenericNotification({ userId: 'u-1', type: 'X', title: 't', message: 'm', actionData: { a: 1 } })
    expect(gravado().actionData).toEqual({ a: 1 })
  })

  it('erro do banco propaga para quem chamou', async () => {
    prismaMock.notification.create.mockRejectedValueOnce(new Error('db down'))
    await expect(inAppNotifications.createGenericNotification({ userId: 'u', type: 'X', title: 't', message: 'm' })).rejects.toThrow('db down')
  })
})
