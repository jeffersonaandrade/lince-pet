import { ApiRequest, created, ok, route, unauthorized } from '@/server/http'
import { requireUser } from '@/server/auth/session'
import { assertVinculoAceito, criarBloqueio, listarBloqueios, serializeBloqueio } from '@/server/services/bloqueios'

/** GET /clinicas/veterinarios/:veterinario_id/bloqueios?de=&ate= */
export const GET = route<{ veterinario_id: string }>(async (req, { veterinario_id }) => {
  const apiReq = await ApiRequest.from(req)
  const user = await requireUser(apiReq, ['clinica'])
  if (!user.clinica) return unauthorized({ message: 'Usuário não autenticado ou não é clínica' })
  await assertVinculoAceito(user.clinica.id, veterinario_id)

  const { de, ate } = apiReq.qs()
  const bloqueios = await listarBloqueios(veterinario_id, de, ate)
  return ok({ data: bloqueios.map(serializeBloqueio) })
})

/** POST /clinicas/veterinarios/:veterinario_id/bloqueios (?preview=1) */
export const POST = route<{ veterinario_id: string }>(async (req, { veterinario_id }) => {
  const apiReq = await ApiRequest.from(req)
  const user = await requireUser(apiReq, ['clinica'])
  if (!user.clinica) return unauthorized({ message: 'Usuário não autenticado ou não é clínica' })
  await assertVinculoAceito(user.clinica.id, veterinario_id)

  const preview = apiReq.qs().preview === '1'
  const result = await criarBloqueio(veterinario_id, apiReq.body, {
    userId: user.id,
    clinicaId: user.clinica.id,
    preview,
  })
  return preview ? ok(result) : created(result)
})
