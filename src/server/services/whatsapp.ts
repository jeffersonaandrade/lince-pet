import 'server-only'
import axios from 'axios'
import { env } from '../env'

const API_URL = 'https://graph.facebook.com/v21.0'

/** Formata para E.164 sem '+'; 10-11 dígitos são tratados como BR sem DDI. */
function formatPhoneNumber(phone: string): string {
  let cleanPhone = phone.replace(/\D/g, '')
  if (cleanPhone.length >= 10 && cleanPhone.length <= 11) {
    cleanPhone = '55' + cleanPhone
  }
  return cleanPhone
}

export async function sendTemplateMessage(
  to: string,
  templateName: string,
  components: any[] = [],
  languageCode: string = 'pt_BR'
) {
  const token = env('WHATSAPP_API_TOKEN')
  const phoneId = env('WHATSAPP_PHONE_ID')
  if (!token || !phoneId) {
    console.warn('WhatsApp credentials not configured. Skipping message send.')
    return
  }

  const formattedPhone = formatPhoneNumber(to)
  const payload = {
    messaging_product: 'whatsapp',
    to: formattedPhone,
    type: 'template',
    template: {
      name: templateName,
      language: { code: languageCode },
      components,
    },
  }

  try {
    const response = await axios.post(`${API_URL}/${phoneId}/messages`, payload, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    })
    console.info(`WhatsApp message sent to ${formattedPhone}. Message ID: ${response.data.messages?.[0]?.id}`)
    return response.data
  } catch (error: any) {
    console.error('Failed to send WhatsApp message', { err: error.response?.data || error.message })
    throw error
  }
}

export const whatsapp = { sendTemplateMessage }
