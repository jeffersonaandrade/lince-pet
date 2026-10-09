// Netlify Scheduled Function: chama a rota de lembretes do Next a cada 15 minutos.
// Requer CRON_SECRET nas variáveis do site; URL é fornecida pela Netlify.
export default async function handler() {
  const base = process.env.URL
  const secret = process.env.CRON_SECRET
  if (!base || !secret) {
    console.warn('[lembretes-whatsapp] URL ou CRON_SECRET ausente; nada a fazer.')
    return new Response('missing config', { status: 500 })
  }

  const res = await fetch(`${base}/api/cron/lembretes-whatsapp`, {
    headers: { Authorization: `Bearer ${secret}` },
  })
  const body = await res.text()
  console.info(`[lembretes-whatsapp] ${res.status} ${body}`)
  return new Response(body, { status: res.status })
}

export const config = { schedule: '*/15 * * * *' }
