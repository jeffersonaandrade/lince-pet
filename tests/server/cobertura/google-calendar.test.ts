import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { jwtVerify } from 'jose'

const prismaMock = vi.hoisted(() => ({
  agendamento: { findUnique: vi.fn() },
  tutor: { findUnique: vi.fn() },
  veterinario: { findUnique: vi.fn() },
  pet: { findUnique: vi.fn() },
  prestador: { findUnique: vi.fn() },
  servicoOferecido: { findUnique: vi.fn() },
  user: { findUnique: vi.fn(), update: vi.fn() },
  agendamentoGoogleEvento: { findUnique: vi.fn(), upsert: vi.fn(), delete: vi.fn() },
}))
vi.mock('@/server/db', () => ({ prisma: prismaMock }))

const axiosMock = vi.hoisted(() => ({ post: vi.fn(), patch: vi.fn(), delete: vi.fn() }))
vi.mock('axios', () => ({ default: axiosMock }))

import { googleCalendar, type CalendarAgendamento, type CalendarUser } from '@/server/services/google-calendar'

const UMA_HORA = 3_600_000
const TOKENS_LIMPOS = { googleCalendarAuthorized: 0, googleAccessToken: null, googleRefreshToken: null, googleTokenExpiresAt: null }

const usuario = (id: string, over: Record<string, unknown> = {}) =>
  ({
    id,
    nome: id,
    sobrenome: 'Silva',
    celular: '81999990000',
    googleCalendarAuthorized: 1,
    googleAccessToken: `tok-${id}`,
    googleRefreshToken: `ref-${id}`,
    googleTokenExpiresAt: new Date(Date.now() + UMA_HORA),
    ...over,
  }) as unknown as CalendarUser

const users: Record<string, CalendarUser | null> = {}
const erroHttp = (status: number, data?: unknown) => Object.assign(new Error(`http ${status}`), { response: { status, data } })

const CONSULTA = {
  id: 'ag-1',
  tutorId: 't1',
  veterinarioId: 'v1',
  petId: 'p1',
  prestadorId: null,
  servicoOferecidoId: null,
  inicioEm: null,
  fimEm: null,
  dataConsulta: '2026-10-20',
  horarioConsulta: '14:00',
  precoConsulta: 150,
  localNome: 'Clínica Centro',
  localEndereco: 'Rua A, 1',
  startCode: '123456',
}

const ultimoUpdate = () => prismaMock.user.update.mock.calls.at(-1)![0]

beforeEach(() => {
  vi.clearAllMocks()
  for (const k of Object.keys(users)) delete users[k]
  users['u-tutor'] = usuario('u-tutor')
  users['u-vet'] = usuario('u-vet', { googleCalendarAuthorized: 0 })
  users['u-prest'] = usuario('u-prest')
  prismaMock.agendamento.findUnique.mockResolvedValue(CONSULTA)
  prismaMock.tutor.findUnique.mockResolvedValue({ id: 't1', userId: 'u-tutor' })
  prismaMock.veterinario.findUnique.mockResolvedValue({ id: 'v1', userId: 'u-vet' })
  prismaMock.pet.findUnique.mockResolvedValue({ id: 'p1', nome: 'Rex', especie: 'cão' })
  prismaMock.prestador.findUnique.mockResolvedValue({ id: 'pr1', userId: 'u-prest', tipoServico: { nome: 'Banho e tosa' } })
  prismaMock.servicoOferecido.findUnique.mockResolvedValue(null)
  prismaMock.user.findUnique.mockImplementation(async ({ where }: { where: { id: string } }) => users[where.id] ?? null)
  prismaMock.user.update.mockResolvedValue({})
  prismaMock.agendamentoGoogleEvento.findUnique.mockResolvedValue(null)
  axiosMock.post.mockResolvedValue({ data: { id: 'evt-novo' } })
  axiosMock.patch.mockResolvedValue({ data: {} })
  axiosMock.delete.mockResolvedValue({ data: {} })
  vi.stubEnv('APP_KEY', 'chave-de-teste-com-32-caracteres!!')
  vi.stubEnv('GOOGLE_CLIENT_ID', 'client-id')
  vi.stubEnv('GOOGLE_CLIENT_SECRET', 'segredo-falso')
  vi.stubEnv('GOOGLE_CALENDAR_CALLBACK_URL', 'http://localhost/cb')
  vi.spyOn(console, 'log').mockImplementation(() => {})
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

describe('getAuthUrl', () => {
  it('monta a URL de consentimento offline com state JWT (userId e retorno padrão /explorar)', async () => {
    const url = new URL(await googleCalendar.getAuthUrl('u1'))
    expect(url.origin + url.pathname).toBe('https://accounts.google.com/o/oauth2/v2/auth')
    expect(url.searchParams.get('client_id')).toBe('client-id')
    expect(url.searchParams.get('redirect_uri')).toBe('http://localhost/cb')
    expect(url.searchParams.get('scope')).toBe('https://www.googleapis.com/auth/calendar.events')
    expect(url.searchParams.get('access_type')).toBe('offline')
    expect(url.searchParams.get('prompt')).toBe('consent')
    const { payload, protectedHeader } = await jwtVerify(
      url.searchParams.get('state')!,
      new TextEncoder().encode('chave-de-teste-com-32-caracteres!!')
    )
    expect(protectedHeader.alg).toBe('HS256')
    expect(payload).toMatchObject({ userId: 'u1', redirectTo: '/explorar' })
    expect(payload.exp! - payload.iat!).toBe(15 * 60)
  })

  it('aceita rota de retorno e tolera client id/callback ausentes', async () => {
    vi.stubEnv('GOOGLE_CLIENT_ID', '')
    vi.stubEnv('GOOGLE_CALENDAR_CALLBACK_URL', '')
    const url = new URL(await googleCalendar.getAuthUrl('u1', '/dashboard'))
    expect(url.searchParams.get('client_id')).toBe('')
    expect(url.searchParams.get('redirect_uri')).toBe('')
    const { payload } = await jwtVerify(url.searchParams.get('state')!, new TextEncoder().encode('chave-de-teste-com-32-caracteres!!'))
    expect(payload.redirectTo).toBe('/dashboard')
  })

  it('sem APP_KEY lança', async () => {
    vi.stubEnv('APP_KEY', '')
    await expect(googleCalendar.getAuthUrl('u1')).rejects.toThrow('APP_KEY')
  })
})

describe('exchangeCodeForTokens', () => {
  it('troca o code e salva tokens, expiração e autorização', async () => {
    axiosMock.post.mockResolvedValueOnce({ data: { access_token: 'at', refresh_token: 'rt', expires_in: 3600 } })
    const user = await googleCalendar.exchangeCodeForTokens('code-1', 'u-tutor')
    expect(axiosMock.post).toHaveBeenCalledWith('https://oauth2.googleapis.com/token', {
      code: 'code-1',
      client_id: 'client-id',
      client_secret: 'segredo-falso',
      redirect_uri: 'http://localhost/cb',
      grant_type: 'authorization_code',
    })
    const arg = ultimoUpdate()
    expect(arg.where).toEqual({ id: 'u-tutor' })
    expect(arg.data).toMatchObject({ googleAccessToken: 'at', googleRefreshToken: 'rt', googleCalendarAuthorized: 1 })
    const exp = (arg.data.googleTokenExpiresAt as Date).getTime()
    expect(exp).toBeGreaterThan(Date.now() + UMA_HORA - 5000)
    expect(user.googleAccessToken).toBe('at')
  })

  it('sem refresh_token (reconsentimento) mantém o anterior', async () => {
    axiosMock.post.mockResolvedValueOnce({ data: { access_token: 'at2', expires_in: 60 } })
    const user = await googleCalendar.exchangeCodeForTokens('c', 'u-tutor')
    expect(ultimoUpdate().data).not.toHaveProperty('googleRefreshToken')
    expect(user.googleRefreshToken).toBe('ref-u-tutor')
  })

  it('usuário inexistente vira erro genérico de autenticação', async () => {
    axiosMock.post.mockResolvedValueOnce({ data: { access_token: 'at', expires_in: 60 } })
    await expect(googleCalendar.exchangeCodeForTokens('c', 'nao-existe')).rejects.toThrow('Falha na autenticação com o Google Calendar.')
    expect(prismaMock.user.update).not.toHaveBeenCalled()
  })

  it('erro do Google é logado com o corpo da resposta', async () => {
    axiosMock.post.mockRejectedValueOnce(erroHttp(400, { error: 'invalid_grant' }))
    await expect(googleCalendar.exchangeCodeForTokens('c', 'u-tutor')).rejects.toThrow('Falha na autenticação')
    expect(console.error).toHaveBeenCalledWith(expect.any(String), { error: 'invalid_grant' })
  })
})

describe('refreshAccessToken', () => {
  it('token válido por mais de 5 min é reaproveitado', async () => {
    expect(await googleCalendar.refreshAccessToken(usuario('u1'))).toBe('tok-u1')
    expect(axiosMock.post).not.toHaveBeenCalled()
  })

  it('faltando menos de 5 min renova com o refresh_token e salva', async () => {
    const user = usuario('u1', { googleTokenExpiresAt: new Date(Date.now() + 60_000) })
    axiosMock.post.mockResolvedValueOnce({ data: { access_token: 'novo', expires_in: 3600 } })
    expect(await googleCalendar.refreshAccessToken(user)).toBe('novo')
    expect(axiosMock.post.mock.calls[0][1]).toEqual({
      client_id: 'client-id',
      client_secret: 'segredo-falso',
      refresh_token: 'ref-u1',
      grant_type: 'refresh_token',
    })
    expect(ultimoUpdate().data.googleAccessToken).toBe('novo')
    expect(user.googleAccessToken).toBe('novo')
  })

  it('sem data de expiração ou sem access token também renova', async () => {
    axiosMock.post.mockResolvedValue({ data: { access_token: 'n', expires_in: 10 } })
    await googleCalendar.refreshAccessToken(usuario('u1', { googleTokenExpiresAt: null }))
    await googleCalendar.refreshAccessToken(usuario('u2', { googleAccessToken: null }))
    expect(axiosMock.post).toHaveBeenCalledTimes(2)
  })

  it('expirado sem refresh_token exige nova autorização', async () => {
    const user = usuario('u1', { googleTokenExpiresAt: null, googleRefreshToken: null })
    await expect(googleCalendar.refreshAccessToken(user)).rejects.toThrow('Refresh token ausente')
  })

  it.each([
    ['invalid_grant', erroHttp(500, { error: 'invalid_grant' })],
    ['400', erroHttp(400)],
    ['401', erroHttp(401)],
  ])('acesso revogado (%s) desliga a integração', async (_n, erro) => {
    axiosMock.post.mockRejectedValueOnce(erro)
    await expect(googleCalendar.refreshAccessToken(usuario('u1', { googleTokenExpiresAt: null }))).rejects.toThrow(
      'Não foi possível renovar as credenciais do Google Calendar.'
    )
    expect(ultimoUpdate().data).toMatchObject(TOKENS_LIMPOS)
  })

  it('erro temporário (500/rede) não desliga a integração', async () => {
    axiosMock.post.mockRejectedValueOnce(erroHttp(503)).mockRejectedValueOnce(new Error('ECONNRESET'))
    const user = usuario('u1', { googleTokenExpiresAt: null })
    await expect(googleCalendar.refreshAccessToken(user)).rejects.toThrow('Não foi possível renovar')
    await expect(googleCalendar.refreshAccessToken(user)).rejects.toThrow('Não foi possível renovar')
    expect(prismaMock.user.update).not.toHaveBeenCalled()
    expect(console.error).toHaveBeenCalledWith(expect.any(String), 'ECONNRESET')
  })
})

describe('sincronizarEvento: consulta veterinária', () => {
  it('cria nos dois participantes conectados com textos por papel e lembretes', async () => {
    users['u-vet'] = usuario('u-vet')
    await googleCalendar.sincronizarEvento('ag-1', 'criar')
    expect(axiosMock.post).toHaveBeenCalledTimes(2)
    const porToken = Object.fromEntries(
      axiosMock.post.mock.calls.map((c) => [c[2].headers.Authorization, c[1]])
    )
    const tutor = porToken['Bearer tok-u-tutor']
    const vet = porToken['Bearer tok-u-vet']
    expect(tutor.summary).toBe('Consulta Veterinária - Pet: Rex (Dr(a). u-vet Silva)')
    expect(tutor.description).toContain('🔍 Código de Início da Consulta: 123456')
    expect(tutor.description).toContain('💰 Valor: R$ 150.00')
    expect(tutor.location).toBe('Clínica Centro - Rua A, 1')
    expect(tutor.start).toEqual({ dateTime: expect.stringContaining('2026-10-20T14:00'), timeZone: 'America/Sao_Paulo' })
    expect(tutor.end.dateTime).toContain('2026-10-20T14:30')
    expect(tutor.reminders).toEqual({
      useDefault: false,
      overrides: [
        { method: 'popup', minutes: 30 },
        { method: 'email', minutes: 120 },
      ],
    })
    expect(vet.summary).toBe('Consulta Veterinária - Tutor: u-tutor Silva (Pet: Rex)')
    expect(vet.description).toContain('📞 Contato do Tutor: 81999990000')
    expect(vet.description).not.toContain('123456')
    expect(prismaMock.agendamentoGoogleEvento.upsert).toHaveBeenCalledTimes(2)
    const upsert = prismaMock.agendamentoGoogleEvento.upsert.mock.calls[0][0]
    expect(upsert.create).toMatchObject({ agendamentoId: 'ag-1', googleEventId: 'evt-novo', id: expect.any(String) })
  })

  it('dados ausentes usam textos padrão (teleconsulta, sem código, pet sem nome)', async () => {
    users['u-vet'] = usuario('u-vet', { nome: null, sobrenome: null, celular: null })
    users['u-tutor'] = usuario('u-tutor', { nome: null, sobrenome: null, celular: null })
    prismaMock.pet.findUnique.mockResolvedValue(null)
    prismaMock.agendamento.findUnique.mockResolvedValue({
      ...CONSULTA,
      localNome: null,
      localEndereco: null,
      startCode: null,
      precoConsulta: null,
    })
    await googleCalendar.sincronizarEvento('ag-1', 'criar')
    const bodies = axiosMock.post.mock.calls.map((c) => c[1])
    const tutor = bodies.find((b) => b.summary.includes('Pet: Pet ('))
    const vet = bodies.find((b) => b.summary.includes('Tutor: Tutor'))
    expect(tutor.summary).toBe('Consulta Veterinária - Pet: Pet (Dr(a).)')
    expect(tutor.description).toContain('Pet (Não informada)')
    expect(tutor.description).toContain('📍 Local: Teleconsulta')
    expect(tutor.description).toContain('🏠 Endereço: Atendimento Online')
    expect(tutor.description).toContain('Não gerado')
    expect(tutor.description).toContain('R$ 0.00')
    expect(tutor.location).toBe('Atendimento Online - Teleconsulta')
    expect(vet.description).toContain('Contato do Tutor: Não cadastrado')
  })

  it('aceita o agendamento já carregado com tutor, vet e pet (sem novas consultas)', async () => {
    const ag = {
      ...CONSULTA,
      tutor: { id: 't1', userId: 'u-tutor' },
      veterinario: { id: 'v1', userId: 'u-vet' },
      pet: { id: 'p1', nome: 'Mia', especie: 'gato' },
    } as unknown as CalendarAgendamento
    await googleCalendar.createEventForAppointment(ag)
    expect(prismaMock.agendamento.findUnique).not.toHaveBeenCalled()
    expect(prismaMock.tutor.findUnique).not.toHaveBeenCalled()
    expect(prismaMock.veterinario.findUnique).not.toHaveBeenCalled()
    expect(prismaMock.pet.findUnique).not.toHaveBeenCalled()
    expect(axiosMock.post.mock.calls[0][1].summary).toContain('Mia')
  })

  it('sem tutor, vet e pet vinculados não consulta nem cria nada', async () => {
    await googleCalendar.sincronizarEvento(
      { ...CONSULTA, tutorId: null, veterinarioId: null, petId: null } as unknown as CalendarAgendamento,
      'criar'
    )
    expect(prismaMock.tutor.findUnique).not.toHaveBeenCalled()
    expect(prismaMock.user.findUnique).not.toHaveBeenCalled()
    expect(axiosMock.post).not.toHaveBeenCalled()
  })

  it('agendamento inexistente: não faz nada', async () => {
    prismaMock.agendamento.findUnique.mockResolvedValueOnce(null)
    await googleCalendar.sincronizarEvento('nao', 'criar')
    expect(prismaMock.tutor.findUnique).not.toHaveBeenCalled()
    expect(axiosMock.post).not.toHaveBeenCalled()
  })

  it('erro ao carregar o contexto é silenciado (nunca lança)', async () => {
    prismaMock.agendamento.findUnique.mockRejectedValueOnce(new Error('db fora'))
    await expect(googleCalendar.sincronizarEvento('ag-1', 'criar')).resolves.toBeUndefined()
    expect(console.error).toHaveBeenCalledWith('[Google Calendar] Erro geral ao sincronizar evento (criar):', 'db fora')
  })

  it.each([401, 403])('%i do Google desliga a integração do usuário e não propaga', async (status) => {
    axiosMock.post.mockRejectedValueOnce(erroHttp(status, { error: 'forbidden' }))
    await expect(googleCalendar.sincronizarEvento('ag-1', 'criar')).resolves.toBeUndefined()
    expect(ultimoUpdate()).toMatchObject({ where: { id: 'u-tutor' }, data: TOKENS_LIMPOS })
    expect(prismaMock.agendamentoGoogleEvento.upsert).not.toHaveBeenCalled()
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining('Erro silenciado (criar)'), { error: 'forbidden' })
  })

  it('token expirado é renovado antes de chamar a API', async () => {
    users['u-tutor'] = usuario('u-tutor', { googleTokenExpiresAt: null })
    axiosMock.post
      .mockResolvedValueOnce({ data: { access_token: 'renovado', expires_in: 3600 } })
      .mockResolvedValueOnce({ data: { id: 'evt-x' } })
    await googleCalendar.sincronizarEvento('ag-1', 'criar')
    expect(axiosMock.post.mock.calls[1][2].headers.Authorization).toBe('Bearer renovado')
  })

  it('atualizar (remarcação) faz PATCH no evento guardado com o novo horário', async () => {
    prismaMock.agendamentoGoogleEvento.findUnique.mockResolvedValue({ id: 'r1', googleEventId: 'evt-1' })
    prismaMock.agendamento.findUnique.mockResolvedValue({ ...CONSULTA, horarioConsulta: '09:30' })
    await googleCalendar.sincronizarEvento('ag-1', 'atualizar')
    expect(prismaMock.agendamentoGoogleEvento.findUnique).toHaveBeenCalledWith({
      where: { agendamentoId_userId: { agendamentoId: 'ag-1', userId: 'u-tutor' } },
    })
    expect(axiosMock.patch.mock.calls[0][1].start.dateTime).toContain('2026-10-20T09:30')
    expect(axiosMock.post).not.toHaveBeenCalled()
    expect(prismaMock.agendamentoGoogleEvento.upsert).not.toHaveBeenCalled()
  })

  it('atualizar sem registro cria o evento', async () => {
    await googleCalendar.sincronizarEvento('ag-1', 'atualizar')
    expect(axiosMock.patch).not.toHaveBeenCalled()
    expect(axiosMock.post).toHaveBeenCalledTimes(1)
    expect(prismaMock.agendamentoGoogleEvento.upsert).toHaveBeenCalled()
  })

  it('atualizar: evento 410 (apagado) cria outro; 500 não cria', async () => {
    prismaMock.agendamentoGoogleEvento.findUnique.mockResolvedValue({ id: 'r1', googleEventId: 'evt/1' })
    axiosMock.patch.mockRejectedValueOnce(erroHttp(410))
    await googleCalendar.sincronizarEvento('ag-1', 'atualizar')
    expect(axiosMock.patch.mock.calls[0][0]).toMatch(/\/events\/evt%2F1$/)
    expect(axiosMock.post).toHaveBeenCalledTimes(1)

    axiosMock.post.mockClear()
    axiosMock.patch.mockRejectedValueOnce(erroHttp(500))
    await googleCalendar.sincronizarEvento('ag-1', 'atualizar')
    expect(axiosMock.post).not.toHaveBeenCalled()
  })

  it('cancelar sem registro não chama o Google', async () => {
    await googleCalendar.sincronizarEvento('ag-1', 'cancelar')
    expect(axiosMock.delete).not.toHaveBeenCalled()
    expect(prismaMock.agendamentoGoogleEvento.delete).not.toHaveBeenCalled()
  })

  it('cancelar: apaga evento e registro; erro 500 mantém o registro', async () => {
    prismaMock.agendamentoGoogleEvento.findUnique.mockResolvedValue({ id: 'r1', googleEventId: 'evt-1' })
    await googleCalendar.sincronizarEvento('ag-1', 'cancelar')
    expect(axiosMock.delete.mock.calls[0][1].headers.Authorization).toBe('Bearer tok-u-tutor')
    expect(prismaMock.agendamentoGoogleEvento.delete).toHaveBeenCalledWith({ where: { id: 'r1' } })

    prismaMock.agendamentoGoogleEvento.delete.mockClear()
    axiosMock.delete.mockRejectedValueOnce(erroHttp(500))
    await expect(googleCalendar.sincronizarEvento('ag-1', 'cancelar')).resolves.toBeUndefined()
    expect(prismaMock.agendamentoGoogleEvento.delete).not.toHaveBeenCalled()
  })
})

describe('sincronizarEvento: pedido de prestador', () => {
  const PEDIDO = {
    ...CONSULTA,
    id: 'ped-1',
    veterinarioId: null,
    prestadorId: 'pr1',
    servicoOferecidoId: 'so1',
    dataConsulta: null,
    horarioConsulta: null,
    inicioEm: new Date('2026-10-20T13:00:00Z'),
    fimEm: new Date('2026-10-22T15:00:00Z'),
    precoConsulta: 80,
    localNome: 'Casa do tutor',
    localEndereco: 'Rua B',
  }

  it('cria evento de serviço (início/fim do pedido) para tutor e prestador', async () => {
    prismaMock.agendamento.findUnique.mockResolvedValue(PEDIDO)
    prismaMock.servicoOferecido.findUnique.mockResolvedValue({ id: 'so1', nome: 'Hospedagem' })
    await googleCalendar.sincronizarEvento('ped-1', 'criar')
    expect(prismaMock.prestador.findUnique).toHaveBeenCalledWith({ where: { id: 'pr1' }, include: { tipoServico: true } })
    expect(prismaMock.servicoOferecido.findUnique).toHaveBeenCalledWith({ where: { id: 'so1' } })
    const porToken = Object.fromEntries(axiosMock.post.mock.calls.map((c) => [c[2].headers.Authorization, c[1]]))
    const tutor = porToken['Bearer tok-u-tutor']
    const prest = porToken['Bearer tok-u-prest']
    expect(tutor.summary).toBe('Hospedagem - Rex (u-prest Silva)')
    expect(tutor.description).toContain('🔍 Código de início: 123456')
    expect(tutor.description).toContain('📅 20/10/2026 10:00 até 22/10/2026 12:00')
    expect(tutor.description).not.toMatch(/Dr\(a\)\.|Consulta/)
    expect(tutor.location).toBe('Casa do tutor - Rua B')
    expect(tutor.start).toEqual({ dateTime: expect.stringContaining('2026-10-20T10:00'), timeZone: 'America/Sao_Paulo' })
    expect(tutor.end.dateTime).toContain('2026-10-22T12:00')
    expect(prest.summary).toBe('Hospedagem - Rex (Tutor: u-tutor Silva)')
    expect(prest.description).toContain('👤 Tutor: u-tutor Silva (81999990000)')
    expect(prest.description).toContain('Peça ao tutor o código de início')
    expect(prest.description).toContain('💰 Valor: R$ 80.00')
  })

  it('sem serviço oferecido usa o tipo do catálogo; sem fim usa o início; padrões de texto', async () => {
    users['u-tutor'] = usuario('u-tutor', { nome: null, sobrenome: null, celular: null })
    users['u-prest'] = usuario('u-prest', { nome: null, sobrenome: null })
    prismaMock.pet.findUnique.mockResolvedValue(null)
    prismaMock.agendamento.findUnique.mockResolvedValue({
      ...PEDIDO,
      servicoOferecidoId: null,
      fimEm: null,
      localNome: null,
      localEndereco: null,
      startCode: null,
      precoConsulta: null,
    })
    await googleCalendar.sincronizarEvento('ped-1', 'criar')
    expect(prismaMock.servicoOferecido.findUnique).not.toHaveBeenCalled()
    const bodies = axiosMock.post.mock.calls.map((c) => c[1])
    const tutor = bodies.find((b) => !b.summary.includes('Tutor:'))
    const prest = bodies.find((b) => b.summary.includes('Tutor:'))
    expect(tutor.summary).toBe('Banho e tosa - Pet (Profissional)')
    expect(tutor.location).toBe('A combinar')
    expect(tutor.description).toContain('Não gerado')
    expect(tutor.description).toContain('R$ 0.00')
    expect(tutor.start.dateTime).toBe(tutor.end.dateTime)
    expect(prest.description).toContain('👤 Tutor: Tutor (sem celular)')
  })

  it('sem nome de serviço nem tipo usa "Serviço pet"', async () => {
    prismaMock.agendamento.findUnique.mockResolvedValue({ ...PEDIDO, servicoOferecidoId: null })
    prismaMock.prestador.findUnique.mockResolvedValue({ id: 'pr1', userId: 'u-prest', tipoServico: null })
    await googleCalendar.sincronizarEvento('ped-1', 'criar')
    expect(axiosMock.post.mock.calls[0][1].summary).toMatch(/^Serviço pet - Rex/)
  })

  it('prestador inexistente: só o tutor recebe', async () => {
    prismaMock.agendamento.findUnique.mockResolvedValue(PEDIDO)
    prismaMock.prestador.findUnique.mockResolvedValue(null)
    await googleCalendar.sincronizarEvento('ped-1', 'criar')
    expect(axiosMock.post).toHaveBeenCalledTimes(1)
    expect(axiosMock.post.mock.calls[0][2].headers.Authorization).toBe('Bearer tok-u-tutor')
  })
})

describe('desconectar', () => {
  it('revoga o refresh token e limpa as credenciais', async () => {
    await googleCalendar.desconectar('u-tutor')
    expect(axiosMock.post).toHaveBeenCalledWith('https://oauth2.googleapis.com/revoke', 'token=ref-u-tutor', {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    })
    expect(ultimoUpdate()).toMatchObject({ where: { id: 'u-tutor' }, data: TOKENS_LIMPOS })
  })

  it('sem refresh token revoga o access token', async () => {
    users['u-tutor'] = usuario('u-tutor', { googleRefreshToken: null })
    await googleCalendar.desconectar('u-tutor')
    expect(axiosMock.post.mock.calls[0][1]).toBe('token=tok-u-tutor')
  })

  it('sem tokens não chama o Google, mas limpa', async () => {
    users['u-tutor'] = usuario('u-tutor', { googleRefreshToken: null, googleAccessToken: null })
    await googleCalendar.desconectar('u-tutor')
    expect(axiosMock.post).not.toHaveBeenCalled()
    expect(prismaMock.user.update).toHaveBeenCalledTimes(1)
  })

  it('falha ao revogar só gera aviso', async () => {
    axiosMock.post.mockRejectedValueOnce(erroHttp(400, 'invalid_token'))
    await googleCalendar.desconectar('u-tutor')
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('Falha ao revogar'), 'invalid_token')
    expect(prismaMock.user.update).toHaveBeenCalledTimes(1)
  })

  it('usuário inexistente: não faz nada', async () => {
    await googleCalendar.desconectar('nao-existe')
    expect(axiosMock.post).not.toHaveBeenCalled()
    expect(prismaMock.user.update).not.toHaveBeenCalled()
  })
})
