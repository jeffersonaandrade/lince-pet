import { json } from '@/server/http'
import { prisma } from '@/server/db'

export const dynamic = 'force-dynamic'

const TIMEOUT_BANCO_MS = 3000
const SEM_CACHE = { headers: { 'Cache-Control': 'no-store' } }

function bancoNoAr() {
  let timer: ReturnType<typeof setTimeout> | undefined
  const limite = new Promise<never>((_, rejeitar) => {
    timer = setTimeout(() => rejeitar(new Error('timeout')), TIMEOUT_BANCO_MS)
  })
  return Promise.race([prisma.$queryRaw`SELECT 1`, limite]).finally(() => clearTimeout(timer))
}

/** GET /health: monitor externo (UptimeRobot). Público e sem detalhes: só diz se app e banco respondem. */
export async function GET() {
  try {
    await bancoNoAr()
    return json({ status: 'ok' }, 200, SEM_CACHE)
  } catch (error) {
    console.error('[Health] Banco indisponível:', error)
    return json({ status: 'erro' }, 503, SEM_CACHE)
  }
}

export const HEAD = GET
