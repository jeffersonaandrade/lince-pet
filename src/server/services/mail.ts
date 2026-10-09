import 'server-only'
import { Resend } from 'resend'
import { env, requiredEnv } from '../env'

let client: Resend | null = null
const resend = () => (client ??= new Resend(requiredEnv('RESEND_API_KEY')))

export const defaultFrom = () => env('EMAIL_FROM') || 'onboarding@resend.dev'

/** Equivalente ao `mail.send` do Adonis; lança erro se o Resend recusar. */
export async function sendMail(message: { to: string; subject: string; html: string; from?: string }) {
  const { error } = await resend().emails.send({
    from: message.from || defaultFrom(),
    to: message.to,
    subject: message.subject,
    html: message.html,
  })
  if (error) throw new Error(`[mail] ${error.name}: ${error.message}`)
}

/** Escapa valores interpolados nos templates (equivalente ao `{{ }}` do Edge). */
export function escapeHtml(value: unknown) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
