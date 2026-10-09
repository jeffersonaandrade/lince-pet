import { ApiRequest, created, notFound, ok, route } from '@/server/http'
import { requireUser } from '@/server/auth/session'
import { criarBloqueio, listarBloqueios, serializeBloqueio } from '@/server/services/bloqueios'

/** GET /veterinarios/bloqueios?de=&ate= */
export const GET = route(async (req) => {
  const apiReq = await ApiRequest.from(req)
  const user = await requireUser(apiReq, ['veterinario'])
  if (!user.veterinario) return notFound({ message: 'Veterinário não encontrado' })

  const { de, ate } = apiReq.qs()
  const bloqueios = await listarBloqueios(user.veterinario.id, de, ate)
  return ok({ data: bloqueios.map(serializeBloqueio) })
})

/** POST /veterinarios/bloqueios (?preview=1 só lista as consultas que seriam canceladas) */
export const POST = route(async (req) => {
  const apiReq = await ApiRequest.from(req)
  const user = await requireUser(apiReq, ['veterinario'])
  if (!user.veterinario) return notFound({ message: 'Veterinário não encontrado' })

  const preview = apiReq.qs().preview === '1'
  const result = await criarBloqueio(user.veterinario.id, apiReq.body, { userId: user.id, preview })
  return preview ? ok(result) : created(result)
})
