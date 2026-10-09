import { ApiRequest, ok, route } from '@/server/http'
import { requireUser } from '@/server/auth/session'
import { aceitarEncaminhamento } from '@/server/services/encaminhamentos'

/** POST /encaminhamentos/:id/aceitar */
export const POST = route<{ id: string }>(async (req, { id }) => {
  const user = await requireUser(await ApiRequest.from(req), ['veterinario', 'clinica', 'prestador'])
  return ok({ message: 'Encaminhamento aceito', data: await aceitarEncaminhamento(user, id) })
})
