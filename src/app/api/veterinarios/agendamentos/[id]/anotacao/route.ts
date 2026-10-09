import { ApiRequest, badRequest, ok, route } from '@/server/http'
import { requireUser } from '@/server/auth/session'
import { findVeterinarioByUser } from '@/server/services/veterinario-dashboard'
import { obterAnotacao, salvarAnotacao, serializeAnotacao } from '@/server/services/anotacoes'

/** GET /veterinarios/agendamentos/:id/anotacao (privado do veterinário) */
export const GET = route<{ id: string }>(async (req, { id }) => {
  const user = await requireUser(await ApiRequest.from(req), ['veterinario'])
  const veterinario = await findVeterinarioByUser(user.id)
  if (!veterinario) return badRequest({ message: 'Veterinário não encontrado' })

  return ok({ anotacao: serializeAnotacao(await obterAnotacao(id, veterinario.id)) })
})

/** PUT /veterinarios/agendamentos/:id/anotacao */
export const PUT = route<{ id: string }>(async (req, { id }) => {
  const apiReq = await ApiRequest.from(req)
  const user = await requireUser(apiReq, ['veterinario'])
  const veterinario = await findVeterinarioByUser(user.id)
  if (!veterinario) return badRequest({ message: 'Veterinário não encontrado' })

  const anotacao = await salvarAnotacao(id, veterinario.id, apiReq.body)
  return ok({ message: 'Anotação salva', anotacao: serializeAnotacao(anotacao) })
})
