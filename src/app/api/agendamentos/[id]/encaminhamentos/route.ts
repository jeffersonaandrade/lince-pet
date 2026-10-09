import { ApiRequest, created, ok, route } from '@/server/http'
import { requireUser } from '@/server/auth/session'
import { criarEncaminhamento, listarEnviados } from '@/server/services/encaminhamentos'

/** GET /agendamentos/:id/encaminhamentos: encaminhamentos enviados a partir desta consulta. */
export const GET = route<{ id: string }>(async (req, { id }) => {
  const user = await requireUser(await ApiRequest.from(req), ['veterinario', 'clinica'])
  return ok({ data: await listarEnviados(user, id) })
})

/** POST /agendamentos/:id/encaminhamentos { destino_tipo, destino_id, motivo, urgencia? } */
export const POST = route<{ id: string }>(async (req, { id }) => {
  const apiReq = await ApiRequest.from(req)
  const user = await requireUser(apiReq, ['veterinario', 'clinica'])
  return created({ message: 'Encaminhamento enviado', data: await criarEncaminhamento(user, id, apiReq.all()) })
})
