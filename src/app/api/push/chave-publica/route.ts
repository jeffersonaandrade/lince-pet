import { ok, route } from '@/server/http'
import { chavePublicaVapid } from '@/server/services/push'

/** GET /push/chave-publica: chave VAPID pública (null = push desligado no servidor). */
export const GET = route(async () => ok({ chave: chavePublicaVapid() }))
