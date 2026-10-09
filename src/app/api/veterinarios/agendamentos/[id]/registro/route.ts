import { ApiRequest, badRequest, ok, route } from '@/server/http'
import { requireUser } from '@/server/auth/session'
import { findVeterinarioByUser } from '@/server/services/veterinario-dashboard'
import { obterRegistro, salvarRegistro, serializeRegistro } from '@/server/services/prontuario'

/** GET /veterinarios/agendamentos/:id/registro (registro clínico do prontuário) */
export const GET = route<{ id: string }>(async (req, { id }) => {
  const user = await requireUser(await ApiRequest.from(req), ['veterinario'])
  const veterinario = await findVeterinarioByUser(user.id)
  if (!veterinario) return badRequest({ message: 'Veterinário não encontrado' })

  return ok({ registro: serializeRegistro(await obterRegistro(id, veterinario.id)) })
})

/** PUT /veterinarios/agendamentos/:id/registro */
export const PUT = route<{ id: string }>(async (req, { id }) => {
  const apiReq = await ApiRequest.from(req)
  const user = await requireUser(apiReq, ['veterinario'])
  const veterinario = await findVeterinarioByUser(user.id)
  if (!veterinario) return badRequest({ message: 'Veterinário não encontrado' })

  const registro = await salvarRegistro(id, veterinario.id, apiReq.body)
  return ok({ message: 'Registro clínico salvo', registro: serializeRegistro(registro) })
})
