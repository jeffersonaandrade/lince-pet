import 'server-only'
import type { User } from '@prisma/client'
import { prisma } from '../db'
import { updating } from '../lucid'

/**
 * Canais de aviso de consultas escolhidos pelo usuário (tutor ou veterinário).
 * E-mail e WhatsApp são preferências; o Google Agenda vale enquanto a conta estiver conectada.
 * Os avisos no app (sino) não são desligáveis.
 */
export type Canais = { email: boolean; whatsapp: boolean; googleAgenda: boolean }

type UserCanais = Pick<User, 'notificarEmail' | 'notificarWhatsapp' | 'googleCalendarAuthorized'>

export const canaisDe = (user: Partial<UserCanais> | null | undefined): Canais => ({
  email: user?.notificarEmail !== 0,
  whatsapp: user?.notificarWhatsapp !== 0,
  googleAgenda: Boolean(user?.googleCalendarAuthorized),
})

export const podeEnviarEmail = (user: Partial<UserCanais> | null | undefined) => canaisDe(user).email

export async function salvarCanais(userId: string, canais: { email?: boolean; whatsapp?: boolean }) {
  const data: Partial<UserCanais> = {}
  if (canais.email !== undefined) data.notificarEmail = canais.email ? 1 : 0
  if (canais.whatsapp !== undefined) data.notificarWhatsapp = canais.whatsapp ? 1 : 0
  const user = Object.keys(data).length
    ? await prisma.user.update({ where: { id: userId }, data: updating(data) })
    : await prisma.user.findUniqueOrThrow({ where: { id: userId } })
  return canaisDe(user)
}

export const serializeCanais = (c: Canais) => ({ email: c.email, whatsapp: c.whatsapp, google_agenda: c.googleAgenda })
