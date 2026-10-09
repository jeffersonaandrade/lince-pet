import { ApiRequest, badRequest, ok, route } from '@/server/http'
import { requireUser } from '@/server/auth/session'
import { findVeterinarioByUser } from '@/server/services/veterinario-dashboard'
import { historicoDoPet } from '@/server/services/anotacoes'

/** GET /veterinarios/agendamentos/:id/anotacao/historico (anotações do próprio vet sobre o mesmo pet) */
export const GET = route<{ id: string }>(async (req, { id }) => {
  const user = await requireUser(await ApiRequest.from(req), ['veterinario'])
  const veterinario = await findVeterinarioByUser(user.id)
  if (!veterinario) return badRequest({ message: 'Veterinário não encontrado' })

  return ok({ data: await historicoDoPet(id, veterinario.id) })
})
