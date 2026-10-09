import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const prismaMock = vi.hoisted(() => ({
  agendamento: { findUnique: vi.fn() },
  tutor: { findUnique: vi.fn() },
  veterinario: { findUnique: vi.fn() },
  pet: { findUnique: vi.fn() },
  user: { findUnique: vi.fn(), findUniqueOrThrow: vi.fn(), update: vi.fn() },
  agendamentoGoogleEvento: { findUnique: vi.fn(), upsert: vi.fn(), delete: vi.fn() },
}))
vi.mock('@/server/db', () => ({ prisma: prismaMock }))

const axiosMock = vi.hoisted(() => ({ post: vi.fn(), patch: vi.fn(), delete: vi.fn() }))
vi.mock('axios', () => ({ default: axiosMock }))

const sessao = vi.hoisted(() => ({ user: {} as Record<string, unknown> }))
vi.mock('@/server/auth/session', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/server/auth/session')>()),
  requireUser: vi.fn(async () => sessao.user),
}))

import { googleCalendar } from '@/server/services/google-calendar'
import { canaisDe, podeEnviarEmail } from '@/server/services/canais-notificacao'
import { GET as getCanais, PUT as putCanais } from '@/app/api/me/notificacoes/route'
import { POST as desconectarRoute } from '@/app/api/google/calendar/disconnect/route'

const conectado = (id: string) => ({
  id,
  nome: id,
  sobrenome: null,
  celular: null,
  googleCalendarAuthorized: 1,
  googleAccessToken: `tok-${id}`,
  googleRefreshToken: `ref-${id}`,
  googleTokenExpiresAt: new Date(Date.now() + 3_600_000),
})

const AGENDAMENTO = {
  id: 'ag-1',
  tutorId: 't1',
  veterinarioId: 'v1',
  petId: 'p1',
  dataConsulta: '2026-10-20',
  horarioConsulta: '14:00',
  precoConsulta: 150,
  localNome: 'Clínica',
  localEndereco: 'Rua A',
  startCode: '123456',
}

const users: Record<string, unknown> = {}
const naoEncontrado = () => Object.assign(new Error('not found'), { response: { status: 404 } })
const params = { params: Promise.resolve({}) }

beforeEach(() => {
  vi.clearAllMocks()
  users['u-tutor'] = conectado('u-tutor')
  users['u-vet'] = { ...conectado('u-vet'), googleCalendarAuthorized: 0 }
  prismaMock.agendamento.findUnique.mockResolvedValue(AGENDAMENTO)
  prismaMock.tutor.findUnique.mockResolvedValue({ id: 't1', userId: 'u-tutor' })
  prismaMock.veterinario.findUnique.mockResolvedValue({ id: 'v1', userId: 'u-vet' })
  prismaMock.pet.findUnique.mockResolvedValue({ id: 'p1', nome: 'Rex', especie: 'cão' })
  prismaMock.user.findUnique.mockImplementation(({ where }: { where: { id: string } }) => users[where.id] ?? null)
  prismaMock.user.update.mockResolvedValue({})
  prismaMock.agendamentoGoogleEvento.findUnique.mockResolvedValue(null)
  axiosMock.post.mockResolvedValue({ data: { id: 'evt-novo' } })
  axiosMock.patch.mockResolvedValue({ data: {} })
  axiosMock.delete.mockResolvedValue({ data: {} })
})

describe('sincronizarEvento', () => {
  it('criar: insere só na agenda de quem está conectado e guarda o id do evento', async () => {
    await googleCalendar.sincronizarEvento('ag-1', 'criar')
    expect(axiosMock.post).toHaveBeenCalledTimes(1)
    expect(axiosMock.post.mock.calls[0][2].headers.Authorization).toBe('Bearer tok-u-tutor')
    expect(prismaMock.agendamentoGoogleEvento.upsert.mock.calls[0][0]).toMatchObject({
      where: { agendamentoId_userId: { agendamentoId: 'ag-1', userId: 'u-tutor' } },
      create: { googleEventId: 'evt-novo' },
    })
  })

  it('atualizar: faz PATCH no evento guardado', async () => {
    prismaMock.agendamentoGoogleEvento.findUnique.mockResolvedValue({ id: 'r1', googleEventId: 'evt-1' })
    await googleCalendar.sincronizarEvento('ag-1', 'atualizar')
    expect(axiosMock.patch.mock.calls[0][0]).toMatch(/\/events\/evt-1$/)
    expect(axiosMock.patch.mock.calls[0][1].start.dateTime).toContain('2026-10-20T14:00')
    expect(axiosMock.post).not.toHaveBeenCalled()
  })

  it('atualizar: evento sumiu no Google (404) cria outro', async () => {
    prismaMock.agendamentoGoogleEvento.findUnique.mockResolvedValue({ id: 'r1', googleEventId: 'evt-1' })
    axiosMock.patch.mockRejectedValue(naoEncontrado())
    await googleCalendar.sincronizarEvento('ag-1', 'atualizar')
    expect(axiosMock.post).toHaveBeenCalledTimes(1)
    expect(prismaMock.agendamentoGoogleEvento.upsert.mock.calls[0][0].update).toMatchObject({ googleEventId: 'evt-novo' })
  })

  it('cancelar: apaga o evento e o registro; 404 conta como apagado', async () => {
    prismaMock.agendamentoGoogleEvento.findUnique.mockResolvedValue({ id: 'r1', googleEventId: 'evt-1' })
    axiosMock.delete.mockRejectedValue(naoEncontrado())
    await googleCalendar.sincronizarEvento('ag-1', 'cancelar')
    expect(axiosMock.delete.mock.calls[0][0]).toMatch(/\/events\/evt-1$/)
    expect(prismaMock.agendamentoGoogleEvento.delete).toHaveBeenCalledWith({ where: { id: 'r1' } })
  })

  it('ninguém conectado: não chama o Google', async () => {
    users['u-tutor'] = { ...conectado('u-tutor'), googleCalendarAuthorized: 0 }
    await googleCalendar.sincronizarEvento('ag-1', 'criar')
    expect(axiosMock.post).not.toHaveBeenCalled()
  })

  it('erro do Google não propaga', async () => {
    axiosMock.post.mockRejectedValue(Object.assign(new Error('boom'), { response: { status: 500 } }))
    await expect(googleCalendar.sincronizarEvento('ag-1', 'criar')).resolves.toBeUndefined()
  })
})

describe('desconectar Google Agenda', () => {
  it('revoga o token, limpa as credenciais e não mexe em agendamentos', async () => {
    sessao.user = { id: 'u-tutor', userType: 'tutor' }
    const res = await desconectarRoute(new NextRequest('http://localhost/api/google/calendar/disconnect', { method: 'POST' }), params)
    expect(res.status).toBe(200)
    expect(axiosMock.post.mock.calls[0][0]).toContain('/revoke')
    expect(prismaMock.user.update.mock.calls[0][0].data).toMatchObject({
      googleCalendarAuthorized: 0,
      googleAccessToken: null,
      googleRefreshToken: null,
    })
    expect(prismaMock.agendamentoGoogleEvento.delete).not.toHaveBeenCalled()
  })

  it('falha ao revogar não impede a desconexão', async () => {
    sessao.user = { id: 'u-tutor', userType: 'tutor' }
    axiosMock.post.mockRejectedValue(new Error('rede'))
    const res = await desconectarRoute(new NextRequest('http://localhost/api/google/calendar/disconnect', { method: 'POST' }), params)
    expect(res.status).toBe(200)
    expect(prismaMock.user.update).toHaveBeenCalled()
  })
})

describe('canais de aviso', () => {
  it('padrão ligado; Google Agenda depende da conexão', () => {
    expect(canaisDe({})).toEqual({ email: true, whatsapp: true, googleAgenda: false })
    expect(canaisDe({ notificarEmail: 0, notificarWhatsapp: 0, googleCalendarAuthorized: 1 })).toEqual({
      email: false,
      whatsapp: false,
      googleAgenda: true,
    })
  })

  it('e-mail desligado não envia', () => {
    expect(podeEnviarEmail({ notificarEmail: 0 })).toBe(false)
    expect(podeEnviarEmail({ notificarEmail: 1 })).toBe(true)
  })

  it('GET /me/notificacoes devolve os canais do usuário', async () => {
    sessao.user = { id: 'u-vet', userType: 'veterinario', notificarEmail: 1, notificarWhatsapp: 0, googleCalendarAuthorized: 1 }
    const res = await getCanais(new NextRequest('http://localhost/api/me/notificacoes'), params)
    expect(await res.json()).toEqual({ email: true, whatsapp: false, google_agenda: true })
  })

  it('PUT /me/notificacoes salva só os campos enviados', async () => {
    sessao.user = { id: 'u-tutor', userType: 'tutor' }
    prismaMock.user.update.mockResolvedValue({ notificarEmail: 0, notificarWhatsapp: 1, googleCalendarAuthorized: 0 })
    const res = await putCanais(
      new NextRequest('http://localhost/api/me/notificacoes', {
        method: 'PUT',
        body: JSON.stringify({ email: false }),
        headers: { 'content-type': 'application/json' },
      }),
      params
    )
    expect(res.status).toBe(200)
    const { data } = prismaMock.user.update.mock.calls[0][0]
    expect(data.notificarEmail).toBe(0)
    expect(data).not.toHaveProperty('notificarWhatsapp')
    expect(await res.json()).toEqual({ email: false, whatsapp: true, google_agenda: false })
  })
})
