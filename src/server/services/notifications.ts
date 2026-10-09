import 'server-only'
import { randomInt } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { env } from '../env'
import { escapeHtml, sendMail } from './mail'
import { sendTemplateMessage } from './whatsapp'
import { appointmentConfirmation } from '../emails/appointment_confirmation'
import { appointmentCancellation } from '../emails/appointment_cancellation'
import { appointmentRescheduled } from '../emails/appointment_rescheduled'
import { appointmentRescheduledVet } from '../emails/appointment_rescheduled_vet'
import { newAppointmentVet } from '../emails/new_appointment_vet'

type SendResult = { success: true } | { success: false; error: unknown }

const LOGO_STYLE = 'height:90px; width:auto; display:block; margin:0 auto;'
const PIX_LOGO_STYLE = 'height:45px; width:auto; display:block; margin:0 auto 10px;'

const fromAddress = () => `Lince Pet <${env('EMAIL_FROM') || 'noreply@lincepet.com'}>`

const generateCode = () => randomInt(100000, 999999).toString()

function getLogoPath() {
  const envPath = process.env.EMAIL_LOGO_PATH
  if (envPath && fs.existsSync(envPath)) return envPath

  const candidates = ['logo.png', 'logo.jpg', 'logo.svg', 'IconSilver.png', 'IconSilver.jpg'].map((f) =>
    path.join(process.cwd(), 'app', 'services', f)
  )
  for (const p of candidates) {
    if (fs.existsSync(p)) return p
  }
  return null
}

function inferContentType(filePath: string) {
  switch (path.extname(filePath).toLowerCase()) {
    case '.png':
      return 'image/png'
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg'
    case '.gif':
      return 'image/gif'
    case '.svg':
      return 'image/svg+xml'
    default:
      return 'application/octet-stream'
  }
}

function toDataUri(base64OrDataUri: string, mime: string) {
  if (base64OrDataUri.trim().startsWith('data:')) return base64OrDataUri.trim()
  const cleaned = base64OrDataUri.replace(/^\s*base64,?/i, '').trim()
  return `data:${mime};base64,${cleaned}`
}

/** EMAIL_LOGO_URL > EMAIL_LOGO_BASE64 > arquivo local. */
function buildLogoHtml(style: string): string | undefined {
  const img = (src: string) => `<img src="${escapeHtml(src)}" alt="Lince Pet" style="${style}" />`

  const url = process.env.EMAIL_LOGO_URL || null
  if (url) return img(url)

  const logoBase64 = process.env.EMAIL_LOGO_BASE64
  const logoMime = process.env.EMAIL_LOGO_MIME || 'image/png'
  const filePath = getLogoPath()
  if (logoBase64) return img(toDataUri(logoBase64, logoMime))
  if (filePath && fs.existsSync(filePath)) {
    try {
      const base64 = fs.readFileSync(filePath).toString('base64')
      return img(toDataUri(base64, inferContentType(filePath)))
    } catch {}
  }
  return undefined
}

/** Envia email de confirmação de agendamento para o tutor (+ WhatsApp se houver telefone). */
async function sendAppointmentConfirmation(
  email: string,
  phone: string | undefined | null,
  payload: {
    nomeTutor: string
    nomeVeterinario: string
    data: string
    horario: string | null
    tipo: string | null
    localNome?: string | null
    observacoes?: string | null
  },
  verificationCode?: string
): Promise<SendResult> {
  try {
    const code = verificationCode || generateCode()
    const logoHtml = buildLogoHtml(LOGO_STYLE)

    console.log(`📨 [NotificationService] Iniciando envio de confirmação para ${email}`)
    await sendMail({
      to: email,
      from: fromAddress(),
      subject: 'Confirmação de Agendamento - Lince Pet',
      html: appointmentConfirmation({ ...payload, verificationCode: code, logoHtml }),
    })
    console.log(`✅ [NotificationService] Email de confirmação enviado para ${email}`)

    if (phone) {
      try {
        console.log(`📱 [NotificationService] Tentando enviar WhatsApp para ${phone}`)
        await sendTemplateMessage(
          phone,
          'confirmacao_agendamento',
          [
            {
              type: 'body',
              parameters: [
                { type: 'text', text: payload.nomeTutor },
                { type: 'text', text: payload.nomeVeterinario },
                { type: 'text', text: payload.data },
                { type: 'text', text: payload.horario },
              ],
            },
          ],
          'pt_BR'
        )
        console.log(`✅ [NotificationService] WhatsApp enviado para ${phone}`)
      } catch (wsError: any) {
        console.error(
          `❌ [NotificationService] Falha WhatsApp: ${wsError?.response?.data?.error?.message || wsError.message}`
        )
      }
    }

    return { success: true }
  } catch (error: any) {
    console.error('❌ [NotificationService] Erro crítico ao enviar email de confirmação:', error)
    if (error.response) {
      console.error(
        '❌ [NotificationService] Detalhes da resposta do provedor:',
        JSON.stringify(error.response, null, 2)
      )
    }
    return { success: false, error }
  }
}

async function sendAppointmentCancellation(
  email: string,
  payload: {
    nomeTutor: string
    nomeVeterinario: string
    data: string
    horario: string | null
    motivo?: string | null
    isVeterinario?: boolean
  }
): Promise<SendResult> {
  try {
    const logoHtml = buildLogoHtml(LOGO_STYLE)
    console.log(`📨 [NotificationService] Tentando enviar email via mail.send para ${email}`)
    await sendMail({
      to: email,
      from: fromAddress(),
      subject: 'Cancelamento de Agendamento - Lince Pet',
      html: appointmentCancellation({ ...payload, logoHtml }),
    })
    console.log(`✅ [NotificationService] mail.send concluído para ${email}`)
    return { success: true }
  } catch (error: any) {
    console.error('❌ [NotificationService] Erro ao enviar email de cancelamento:', error)
    if (error.response) {
      console.error('❌ [Resend/SMTP Response]:', error.response)
    }
    return { success: false, error }
  }
}

async function sendAppointmentRescheduled(
  email: string,
  payload: {
    nomeTutor: string
    nomeVeterinario: string
    data: string
    horario: string | null
    tipo: string | null
    localNome?: string | null
    verificationCode: string
  }
): Promise<SendResult> {
  try {
    const logoHtml = buildLogoHtml(LOGO_STYLE)
    await sendMail({
      to: email,
      from: fromAddress(),
      subject: 'Agendamento Reagendado - Lince Pet',
      html: appointmentRescheduled({ ...payload, logoHtml }),
    })
    return { success: true }
  } catch (error) {
    console.error('Erro ao enviar email de reagendamento:', error)
    return { success: false, error }
  }
}

async function sendAppointmentRescheduledToVeterinarian(
  email: string,
  payload: {
    nomeVeterinario: string
    nomeTutor: string
    data: string
    horario: string | null
    tipo: string | null
    localNome?: string | null
  }
): Promise<SendResult> {
  try {
    const logoHtml = buildLogoHtml(LOGO_STYLE)
    await sendMail({
      to: email,
      from: fromAddress(),
      subject: 'Aviso de Reagendamento - Lince Pet',
      html: appointmentRescheduledVet({ ...payload, logoHtml }),
    })
    return { success: true }
  } catch (error) {
    console.error('Erro ao enviar email de reagendamento para o veterinário:', error)
    return { success: false, error }
  }
}

type PixPayload = {
  nomeTutor: string
  descricao: string
  valor: number
  currency?: string
  qrEncodedImage?: string | null
  pixPayload?: string | null
  expirationDate?: string | null
  invoiceUrl?: string | null
}

function composePixEmailHtml(payload: PixPayload & { logoHtml?: string }) {
  const { nomeTutor, descricao, valor, currency = 'BRL', qrEncodedImage, pixPayload, expirationDate, invoiceUrl, logoHtml } =
    payload

  const qrHtml = qrEncodedImage
    ? `<div style="text-align:center;margin:16px 0;">
          <img src="${escapeHtml(qrEncodedImage)}" alt="QR PIX" style="max-width:260px;border:1px solid #eee;border-radius:8px;" />
        </div>`
    : ''

  const payloadHtml = pixPayload
    ? `<div style="background:#f8f9fa;border:1px dashed #ccc;border-radius:8px;padding:12px;margin:12px 0;word-break:break-all;font-family:'Courier New',monospace;">
          ${escapeHtml(pixPayload)}
        </div>`
    : ''

  const vencHtml = expirationDate
    ? `<p style="color:#555;margin:6px 0;">Validade do QR: ${escapeHtml(expirationDate)}</p>`
    : ''

  const linkHtml = invoiceUrl
    ? `<p style="margin:10px 0;">
           <a href="${escapeHtml(invoiceUrl)}" style="background:#e67e22;color:#fff;text-decoration:none;padding:10px 14px;border-radius:8px;display:inline-block;">Abrir página de pagamento</a>
         </p>`
    : ''

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Pagamento PIX</title>
  <style>
    body { font-family:"Inter", -apple-system, BlinkMacSystemFont, sans-serif; background:#f5f5f5; padding:20px; }
    .container { max-width:650px; margin:0 auto; background:#fff; border-radius:12px; overflow:hidden; box-shadow:0 2px 8px rgba(0,0,0,0.06); }
    .header { background:#e67e22; color:#fff; text-align:center; }
    .content { padding:26px; }
    .details { background:#f8f9fa; border-radius:8px; padding:16px; margin:12px 0; }
    p { font-size:16px; color:#333; margin:6px 0; }
  </style>
  </head>
  <body>
    <div class="container">
      <div class="header">
        ${logoHtml || '<div style="font-size: 28px; font-weight: bold; color: #ffffff; padding: 20px;">🐾 Lince Pet</div>'}
      </div>
      <div class="content">
        <p>Olá ${escapeHtml(nomeTutor)},</p>
        <p>Segue o PIX para pagamento: <strong>${escapeHtml(descricao)}</strong></p>
        <div class="details">
          <p><strong>Valor:</strong> ${escapeHtml(valor.toLocaleString('pt-BR', { style: 'currency', currency }))}</p>
          ${vencHtml}
        </div>
        ${qrHtml}
        <p>Se preferir, copie e cole o código PIX abaixo no app do seu banco:</p>
        ${payloadHtml}
        ${linkHtml}
        <p style="margin-top:14px;color:#555;">Após a confirmação do banco, sua consulta será marcada como paga automaticamente.</p>
      </div>
    </div>
  </body>
  </html>`
}

/** Envia email com instruções de pagamento PIX (QR e código copia/cola). */
async function sendPixPaymentEmail(email: string, payload: PixPayload): Promise<SendResult> {
  try {
    const html = composePixEmailHtml({ ...payload, logoHtml: buildLogoHtml(PIX_LOGO_STYLE) })
    await sendMail({ to: email, from: fromAddress(), subject: 'Pagamento da consulta - PIX', html })
    return { success: true }
  } catch (error) {
    console.error('Erro ao enviar email de PIX:', error)
    return { success: false, error }
  }
}

/** Notifica o veterinário sobre novo agendamento (sem código). */
async function sendNewAppointmentToVeterinarian(
  email: string,
  payload: {
    nomeVeterinario: string
    nomeTutor: string
    data: string
    horario: string | null
    tipo: string | null
    localNome?: string | null
    observacoes?: string | null
    contatoTutor?: { email?: string | null; celular?: string | null }
  }
): Promise<SendResult> {
  try {
    console.log(`📨 [NotificationService] Enviando email de novo agendamento para: ${email}`)
    const logoHtml = buildLogoHtml(LOGO_STYLE)
    await sendMail({
      to: email,
      from: fromAddress(),
      subject: 'Novo agendamento recebido - Lince Pet',
      html: newAppointmentVet({ ...payload, logoHtml }),
    })
    console.log(`✅ [NotificationService] Email enviado com sucesso para: ${email}`)
    return { success: true }
  } catch (error) {
    console.error('❌ [NotificationService] Erro ao enviar email de notificação ao veterinário:', error)
    return { success: false, error }
  }
}

export const notifications = {
  sendAppointmentConfirmation,
  sendAppointmentCancellation,
  sendAppointmentRescheduled,
  sendAppointmentRescheduledToVeterinarian,
  sendPixPaymentEmail,
  sendNewAppointmentToVeterinarian,
}
