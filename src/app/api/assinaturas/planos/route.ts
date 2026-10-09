import { badRequest, ok, route } from '@/server/http'
import { listarPlanosAtivos } from '@/server/services/subscription'

const PUBLICO = new Set(['veterinario', 'clinica', 'prestador'])

export const GET = route(async (req) => {
  const tipo = new URL(req.url).searchParams.get('tipo')
  if (tipo && !PUBLICO.has(tipo)) return badRequest({ message: 'tipo inválido' })
  const plans = await listarPlanosAtivos(tipo === 'clinica' || tipo === 'prestador' || tipo === 'veterinario' ? tipo : undefined)
  return ok({ plans })
})
