import 'server-only'
import { DateTime } from 'luxon'
import axios from 'axios'
import { SignJWT } from 'jose'
import type { Agendamento, Clinica, Pet, Tutor, User, Veterinario } from '@prisma/client'
import { prisma } from '../db'
import { env, requiredEnv } from '../env'
import { creating, updating } from '../lucid'
import { consumeDataConsulta, inicioDaConsulta } from './agendamentos'

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth'
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token'
const GOOGLE_REVOKE_URL = 'https://oauth2.googleapis.com/revoke'
const GOOGLE_CALENDAR_API_URL = 'https://www.googleapis.com/calendar/v3/calendars/primary/events'

/** O client global omite os tokens do Google; aqui eles são necessários. */
const WITH_TOKENS = { googleAccessToken: false, googleRefreshToken: false, googleTokenExpiresAt: false } as const

const TOKENS_LIMPOS = {
  googleCalendarAuthorized: 0,
  googleAccessToken: null,
  googleRefreshToken: null,
  googleTokenExpiresAt: null,
} as const

export type CalendarUser = Omit<User, 'password'>

export type CalendarAgendamento = Agendamento & {
  tutor?: (Tutor & { user?: unknown }) | null
  veterinario?: (Veterinario & { user?: unknown }) | null
  pet?: Pet | null
  clinica?: Clinica | null
}

export type AcaoAgenda = 'criar' | 'atualizar' | 'cancelar'

async function saveUser(user: CalendarUser, data: Partial<CalendarUser>) {
  Object.assign(user, data)
  await prisma.user.update({ where: { id: user.id }, data: updating(data) })
}

/**
 * URL de autorização do Google OAuth (Calendar). O `state` é um JWT (APP_KEY, 15m)
 * com o userId e a rota de retorno no frontend.
 */
async function getAuthUrl(userId: string, redirectTo: string = '/explorar'): Promise<string> {
  const clientId = env('GOOGLE_CLIENT_ID')
  const redirectUri = env('GOOGLE_CALENDAR_CALLBACK_URL')

  const state = await new SignJWT({ userId, redirectTo })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setIssuedAt()
    .setExpirationTime('15m')
    .sign(new TextEncoder().encode(requiredEnv('APP_KEY')))

  const params = new URLSearchParams({
    client_id: clientId || '',
    redirect_uri: redirectUri || '',
    response_type: 'code',
    scope: 'https://www.googleapis.com/auth/calendar.events',
    access_type: 'offline',
    prompt: 'consent',
    state,
  })

  return `${GOOGLE_AUTH_URL}?${params.toString()}`
}

/** Troca o authorization code pelos tokens do Google e os vincula ao usuário. */
async function exchangeCodeForTokens(code: string, userId: string): Promise<CalendarUser> {
  try {
    console.log(`[Google Calendar] Trocando code por tokens para o usuário ${userId}...`)

    const response = await axios.post(GOOGLE_TOKEN_URL, {
      code,
      client_id: env('GOOGLE_CLIENT_ID'),
      client_secret: env('GOOGLE_CLIENT_SECRET'),
      redirect_uri: env('GOOGLE_CALENDAR_CALLBACK_URL'),
      grant_type: 'authorization_code',
    })

    const { access_token, refresh_token, expires_in } = response.data

    const user = await prisma.user.findUnique({ where: { id: userId }, omit: WITH_TOKENS })
    if (!user) throw new Error('Row not found')

    // Google só retorna o refresh_token no primeiro consentimento; se ausente, mantém o anterior.
    await saveUser(user, {
      googleAccessToken: access_token,
      ...(refresh_token ? { googleRefreshToken: refresh_token } : {}),
      googleTokenExpiresAt: DateTime.now().plus({ seconds: expires_in }).toJSDate(),
      googleCalendarAuthorized: 1,
    })

    console.log(`[Google Calendar] Autorização do usuário ${userId} salva com sucesso.`)
    return user
  } catch (error: any) {
    console.error(
      '[Google Calendar] Erro ao trocar código de autorização pelos tokens:',
      error.response?.data || error.message
    )
    throw new Error('Falha na autenticação com o Google Calendar.')
  }
}

/** Garante access_token válido; renova com o refresh_token se faltar menos de 5 minutos. */
async function refreshAccessToken(user: CalendarUser): Promise<string> {
  const isExpired =
    !user.googleTokenExpiresAt ||
    DateTime.now().plus({ minutes: 5 }) >= DateTime.fromJSDate(user.googleTokenExpiresAt)

  if (!isExpired && user.googleAccessToken) {
    return user.googleAccessToken
  }

  if (!user.googleRefreshToken) {
    throw new Error('Refresh token ausente. O usuário precisa autorizar o Google Calendar novamente.')
  }

  try {
    console.log(`[Google Calendar] Renovando token de acesso para o usuário ${user.id}...`)

    const response = await axios.post(GOOGLE_TOKEN_URL, {
      client_id: env('GOOGLE_CLIENT_ID'),
      client_secret: env('GOOGLE_CLIENT_SECRET'),
      refresh_token: user.googleRefreshToken,
      grant_type: 'refresh_token',
    })

    const { access_token, expires_in } = response.data
    await saveUser(user, {
      googleAccessToken: access_token,
      googleTokenExpiresAt: DateTime.now().plus({ seconds: expires_in }).toJSDate(),
    })

    console.log(`[Google Calendar] Token do usuário ${user.id} renovado com sucesso.`)
    return access_token
  } catch (error: any) {
    console.error(
      `[Google Calendar] Erro ao renovar token para o usuário ${user.id}:`,
      error.response?.data || error.message
    )

    const errResponse = error.response?.data?.error || ''
    if (errResponse === 'invalid_grant' || error.response?.status === 400 || error.response?.status === 401) {
      console.warn(`[Google Calendar] Acesso revogado pelo usuário ${user.id}. Desativando integração...`)
      await saveUser(user, TOKENS_LIMPOS)
    }

    throw new Error('Não foi possível renovar as credenciais do Google Calendar.')
  }
}

/** Data da consulta + "HH:MM" interpretados em America/Sao_Paulo. */
function buildEventDateTime(dataConsulta: DateTime, horarioConsulta: string): DateTime {
  return inicioDaConsulta(dataConsulta.toISODate()!, horarioConsulta)
}

type Papel = 'tutor' | 'veterinario'

type EventContext = {
  agendamento: CalendarAgendamento
  tutorUser: CalendarUser | null
  vetUser: CalendarUser | null
  pet: Pet | null
}

function montarEvento(ctx: EventContext, role: Papel) {
  const { agendamento, pet } = ctx
  const startDateTime = buildEventDateTime(
    consumeDataConsulta(agendamento.dataConsulta)!,
    agendamento.horarioConsulta!
  )
  const endDateTime = startDateTime.plus({ minutes: 30 })

  const petNome = pet?.nome || 'Pet'
  const tutorNome = `${ctx.tutorUser?.nome || 'Tutor'} ${ctx.tutorUser?.sobrenome || ''}`.trim()
  const vetNome = `Dr(a). ${ctx.vetUser?.nome || ''} ${ctx.vetUser?.sobrenome || ''}`.trim()
  const preco = (Number(agendamento.precoConsulta) || 0).toFixed(2)

  let summary = ''
  let description = ''

  if (role === 'tutor') {
    summary = `Consulta Veterinária - Pet: ${petNome} (${vetNome})`
    description = `
Olá! Este é o lembrete da sua consulta veterinária marcada no Lince Pet.

🐾 Pet: ${petNome} (${pet?.especie || 'Não informada'})
👨‍⚕️ Veterinário: ${vetNome}
📅 Data: ${startDateTime.toFormat('dd/MM/yyyy')} às ${agendamento.horarioConsulta}
📍 Local: ${agendamento.localNome || 'Teleconsulta'}
🏠 Endereço: ${agendamento.localEndereco || 'Atendimento Online'}
💰 Valor: R$ ${preco}
🔍 Código de Início da Consulta: ${agendamento.startCode || 'Não gerado'}

Por favor, apresente o código acima ao veterinário ao iniciar o atendimento.
`.trim()
  } else {
    summary = `Consulta Veterinária - Tutor: ${tutorNome} (Pet: ${petNome})`
    description = `
Olá, ${vetNome}! Você tem uma consulta agendada pelo Lince Pet.

🐾 Pet: ${petNome} (${pet?.especie || 'Não informada'})
👤 Tutor: ${tutorNome}
📞 Contato do Tutor: ${ctx.tutorUser?.celular || 'Não cadastrado'}
📅 Data: ${startDateTime.toFormat('dd/MM/yyyy')} às ${agendamento.horarioConsulta}
📍 Local: ${agendamento.localNome || 'Teleconsulta'}
🏠 Endereço: ${agendamento.localEndereco || 'Atendimento Online'}
💰 Valor: R$ ${preco}

Insira o código fornecido pelo tutor no painel para dar início oficial ao atendimento.
`.trim()
  }

  return {
    summary,
    location: `${agendamento.localNome || 'Atendimento Online'} - ${agendamento.localEndereco || 'Teleconsulta'}`,
    description,
    status: 'confirmed',
    start: { dateTime: startDateTime.toISO(), timeZone: 'America/Sao_Paulo' },
    end: { dateTime: endDateTime.toISO(), timeZone: 'America/Sao_Paulo' },
    reminders: {
      useDefault: false,
      overrides: [
        { method: 'popup', minutes: 30 },
        { method: 'email', minutes: 120 },
      ],
    },
  }
}

type ErroHttp = { message?: string; response?: { status?: number; data?: unknown } }

const statusDe = (error: unknown) => (error as ErroHttp | null)?.response?.status
const eventoSumiu = (error: unknown) => statusDe(error) === 404 || statusDe(error) === 410
const detalheDo = (error: unknown) => (error as ErroHttp).response?.data || (error as ErroHttp).message

/** Chama a API do Calendar; 401/403 desativa a integração do usuário. */
async function chamarApi<T>(user: CalendarUser, fn: (headers: Record<string, string>) => Promise<T>): Promise<T> {
  const token = await refreshAccessToken(user)
  try {
    return await fn({ 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' })
  } catch (error) {
    if (statusDe(error) === 401 || statusDe(error) === 403) {
      console.warn(`[Google Calendar] Permissões inválidas para o usuário ${user.id}. Desativando integração...`)
      await saveUser(user, TOKENS_LIMPOS)
    }
    throw error
  }
}

async function inserirEvento(user: CalendarUser, body: object): Promise<string> {
  const res = await chamarApi(user, (headers) => axios.post(GOOGLE_CALENDAR_API_URL, body, { headers }))
  return res.data.id
}

const urlDoEvento = (eventId: string) => `${GOOGLE_CALENDAR_API_URL}/${encodeURIComponent(eventId)}`

async function gravarEvento(agendamentoId: string, userId: string, googleEventId: string) {
  await prisma.agendamentoGoogleEvento.upsert({
    where: { agendamentoId_userId: { agendamentoId, userId } },
    create: creating({ agendamentoId, userId, googleEventId }),
    update: updating({ googleEventId }),
  })
}

/** Aplica a ação no Google Agenda de um participante conectado. */
async function sincronizarParticipante(user: CalendarUser, ctx: EventContext, role: Papel, acao: AcaoAgenda) {
  const agendamentoId = ctx.agendamento.id
  const registro = await prisma.agendamentoGoogleEvento.findUnique({
    where: { agendamentoId_userId: { agendamentoId, userId: user.id } },
  })

  if (acao === 'cancelar') {
    if (!registro) return
    try {
      await chamarApi(user, (headers) => axios.delete(urlDoEvento(registro.googleEventId), { headers }))
    } catch (error) {
      if (!eventoSumiu(error)) throw error
    }
    await prisma.agendamentoGoogleEvento.delete({ where: { id: registro.id } })
    console.log(`[Google Calendar] Evento removido da agenda do ${role} (User ID: ${user.id}).`)
    return
  }

  const body = montarEvento(ctx, role)
  if (registro) {
    try {
      await chamarApi(user, (headers) => axios.patch(urlDoEvento(registro.googleEventId), body, { headers }))
      console.log(`[Google Calendar] Evento atualizado na agenda do ${role} (User ID: ${user.id}).`)
      return
    } catch (error) {
      if (!eventoSumiu(error)) throw error
    }
  }

  await gravarEvento(agendamentoId, user.id, await inserirEvento(user, body))
  console.log(`[Google Calendar] Evento criado na agenda do ${role} (User ID: ${user.id}).`)
}

const findUserWithTokens = (id: string | null | undefined) =>
  id ? prisma.user.findUnique({ where: { id }, omit: WITH_TOKENS }) : Promise.resolve(null)

async function carregarContexto(agendamento: string | CalendarAgendamento): Promise<EventContext | null> {
  const a: CalendarAgendamento | null =
    typeof agendamento === 'string' ? await prisma.agendamento.findUnique({ where: { id: agendamento } }) : agendamento
  if (!a) return null

  const tutor = a.tutor ?? (a.tutorId ? await prisma.tutor.findUnique({ where: { id: a.tutorId } }) : null)
  const veterinario =
    a.veterinario ?? (a.veterinarioId ? await prisma.veterinario.findUnique({ where: { id: a.veterinarioId } }) : null)
  const pet = a.pet ?? (a.petId ? await prisma.pet.findUnique({ where: { id: a.petId } }) : null)

  const [tutorUser, vetUser] = await Promise.all([
    findUserWithTokens(tutor?.userId),
    findUserWithTokens(veterinario?.userId),
  ])
  return { agendamento: a, tutorUser, vetUser, pet }
}

/**
 * Cria, atualiza (remarcação) ou apaga (cancelamento) o evento da consulta no Google Agenda
 * de cada participante conectado. Nunca lança.
 */
async function sincronizarEvento(agendamento: string | CalendarAgendamento, acao: AcaoAgenda): Promise<void> {
  try {
    const ctx = await carregarContexto(agendamento)
    if (!ctx) return

    const participantes: [CalendarUser | null, Papel][] = [
      [ctx.tutorUser, 'tutor'],
      [ctx.vetUser, 'veterinario'],
    ]
    await Promise.all(
      participantes
        .filter(([user]) => user?.googleCalendarAuthorized)
        .map(([user, role]) =>
          sincronizarParticipante(user!, ctx, role, acao).catch((err) =>
            console.error(
              `[Google Calendar] Erro silenciado (${acao}) na agenda do ${role} (User ID: ${user!.id}):`,
              detalheDo(err)
            )
          )
        )
    )
  } catch (e) {
    console.error(`[Google Calendar] Erro geral ao sincronizar evento (${acao}):`, detalheDo(e))
  }
}

/** Cria o evento no calendário do tutor e/ou veterinário que autorizaram. Nunca lança. */
const createEventForAppointment = (agendamento: CalendarAgendamento) => sincronizarEvento(agendamento, 'criar')

/**
 * Desconecta o Google Agenda: revoga o token no Google (melhor esforço) e limpa as credenciais.
 * Não mexe em agendamentos nem nos eventos já criados.
 */
async function desconectar(userId: string): Promise<void> {
  const user = await findUserWithTokens(userId)
  if (!user) return
  const token = user.googleRefreshToken || user.googleAccessToken
  if (token) {
    try {
      await axios.post(GOOGLE_REVOKE_URL, new URLSearchParams({ token }).toString(), {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      })
    } catch (error) {
      console.warn(`[Google Calendar] Falha ao revogar token do usuário ${userId}:`, detalheDo(error))
    }
  }
  await saveUser(user, TOKENS_LIMPOS)
}

export const googleCalendar = {
  getAuthUrl,
  exchangeCodeForTokens,
  refreshAccessToken,
  createEventForAppointment,
  sincronizarEvento,
  desconectar,
}
