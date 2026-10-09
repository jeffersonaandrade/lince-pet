import 'server-only'
import { DateTime } from 'luxon'
import axios from 'axios'
import { SignJWT } from 'jose'
import type { Agendamento, Clinica, Pet, Tutor, User, Veterinario } from '@prisma/client'
import { prisma } from '../db'
import { env, requiredEnv } from '../env'
import { updating } from '../lucid'
import { consumeDataConsulta } from './agendamentos'

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth'
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token'
const GOOGLE_CALENDAR_API_URL = 'https://www.googleapis.com/calendar/v3/calendars/primary/events'

/** O client global omite os tokens do Google; aqui eles são necessários. */
const WITH_TOKENS = { googleAccessToken: false, googleRefreshToken: false, googleTokenExpiresAt: false } as const

export type CalendarUser = Omit<User, 'password'>

export type CalendarAgendamento = Agendamento & {
  tutor?: (Tutor & { user?: unknown }) | null
  veterinario?: (Veterinario & { user?: unknown }) | null
  pet?: Pet | null
  clinica?: Clinica | null
}

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
      await saveUser(user, {
        googleCalendarAuthorized: 0,
        googleAccessToken: null,
        googleRefreshToken: null,
        googleTokenExpiresAt: null,
      })
    }

    throw new Error('Não foi possível renovar as credenciais do Google Calendar.')
  }
}

/** Data da consulta + "HH:MM" interpretados em America/Sao_Paulo. */
function buildEventDateTime(dataConsulta: DateTime, horarioConsulta: string): DateTime {
  const [hours, minutes] = horarioConsulta.split(':').map(Number)
  return DateTime.fromObject(
    { year: dataConsulta.year, month: dataConsulta.month, day: dataConsulta.day, hour: hours, minute: minutes },
    { zone: 'America/Sao_Paulo' }
  )
}

type EventContext = {
  agendamento: CalendarAgendamento
  tutorUser: CalendarUser | null
  vetUser: CalendarUser | null
  pet: Pet | null
}

async function addEventToUserCalendar(
  user: CalendarUser,
  ctx: EventContext,
  role: 'tutor' | 'veterinario'
): Promise<void> {
  const { agendamento, pet } = ctx
  const token = await refreshAccessToken(user)

  const startDateTime = buildEventDateTime(
    consumeDataConsulta(agendamento.dataConsulta)!,
    agendamento.horarioConsulta!
  )
  const endDateTime = startDateTime.plus({ minutes: 30 })

  const petNome = pet?.nome || 'Pet'
  const tutorNome = `${ctx.tutorUser!.nome} ${ctx.tutorUser!.sobrenome || ''}`.trim()
  const vetNome = `Dr(a). ${ctx.vetUser!.nome} ${ctx.vetUser!.sobrenome || ''}`.trim()
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
Olá, Dr(a). ${ctx.vetUser!.nome}! Você tem uma nova consulta agendada pelo Lince Pet.

🐾 Pet: ${petNome} (${pet?.especie || 'Não informada'})
👤 Tutor: ${tutorNome}
📞 Contato do Tutor: ${ctx.tutorUser!.celular || 'Não cadastrado'}
📅 Data: ${startDateTime.toFormat('dd/MM/yyyy')} às ${agendamento.horarioConsulta}
📍 Local: ${agendamento.localNome || 'Teleconsulta'}
🏠 Endereço: ${agendamento.localEndereco || 'Atendimento Online'}
💰 Valor: R$ ${preco}
🔍 Código de Início Necessário: ${agendamento.startCode || 'Aguardando geração'}

Insira o código fornecido pelo tutor no painel para dar início oficial ao atendimento.
`.trim()
  }

  const location = `${agendamento.localNome || 'Atendimento Online'} - ${agendamento.localEndereco || 'Teleconsulta'}`

  try {
    await axios.post(
      GOOGLE_CALENDAR_API_URL,
      {
        summary,
        location,
        description,
        start: { dateTime: startDateTime.toISO(), timeZone: 'America/Sao_Paulo' },
        end: { dateTime: endDateTime.toISO(), timeZone: 'America/Sao_Paulo' },
        reminders: {
          useDefault: false,
          overrides: [
            { method: 'popup', minutes: 30 },
            { method: 'email', minutes: 120 },
          ],
        },
      },
      { headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' } }
    )

    console.log(`[Google Calendar] Evento criado com sucesso no calendário do ${role} (User ID: ${user.id}).`)
  } catch (error: any) {
    console.error(
      `[Google Calendar] Falha ao enviar evento para a Google API (User ID: ${user.id}):`,
      error.response?.data || error.message
    )

    if (error.response?.status === 401 || error.response?.status === 403) {
      console.warn(`[Google Calendar] Permissões inválidas para o usuário ${user.id}. Desativando integração...`)
      await saveUser(user, {
        googleCalendarAuthorized: 0,
        googleAccessToken: null,
        googleRefreshToken: null,
        googleTokenExpiresAt: null,
      })
    }

    throw error
  }
}

const findUserWithTokens = (id: string | null | undefined) =>
  id ? prisma.user.findUnique({ where: { id }, omit: WITH_TOKENS }) : Promise.resolve(null)

/** Cria o evento no calendário do tutor e/ou veterinário que autorizaram. Nunca lança. */
async function createEventForAppointment(agendamento: CalendarAgendamento): Promise<void> {
  try {
    const tutor =
      agendamento.tutor ??
      (agendamento.tutorId ? await prisma.tutor.findUnique({ where: { id: agendamento.tutorId } }) : null)
    const veterinario =
      agendamento.veterinario ??
      (agendamento.veterinarioId
        ? await prisma.veterinario.findUnique({ where: { id: agendamento.veterinarioId } })
        : null)
    const pet =
      agendamento.pet ??
      (agendamento.petId ? await prisma.pet.findUnique({ where: { id: agendamento.petId } }) : null)

    const [tutorUser, vetUser] = await Promise.all([
      findUserWithTokens(tutor?.userId),
      findUserWithTokens(veterinario?.userId),
    ])

    const ctx: EventContext = { agendamento, tutorUser, vetUser, pet }
    const promises: Promise<any>[] = []

    if (tutorUser && tutorUser.googleCalendarAuthorized) {
      promises.push(
        addEventToUserCalendar(tutorUser, ctx, 'tutor').catch((err) => {
          console.error(
            `[Google Calendar] Erro silenciado ao criar evento para o Tutor (User ID: ${tutorUser.id}):`,
            err.message
          )
        })
      )
    }

    if (vetUser && vetUser.googleCalendarAuthorized) {
      promises.push(
        addEventToUserCalendar(vetUser, ctx, 'veterinario').catch((err) => {
          console.error(
            `[Google Calendar] Erro silenciado ao criar evento para o Veterinário (User ID: ${vetUser.id}):`,
            err.message
          )
        })
      )
    }

    if (promises.length > 0) {
      console.log(
        `[Google Calendar] Disparando ${promises.length} criação(ões) de evento para o agendamento ${agendamento.id}...`
      )
      await Promise.all(promises)
    } else {
      console.log(
        `[Google Calendar] Nenhum participante do agendamento ${agendamento.id} autorizou a integração do calendário.`
      )
    }
  } catch (e: any) {
    console.error('[Google Calendar] Erro geral ao disparar criação de eventos:', e.message)
  }
}

export const googleCalendar = {
  getAuthUrl,
  exchangeCodeForTokens,
  refreshAccessToken,
  createEventForAppointment,
}
