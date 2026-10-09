import { ApiRequest, ok, route } from '@/server/http'
import { requireUser } from '@/server/auth/session'
import { assertAcessoProntuario, prontuarioDoPet, serializePetProntuario } from '@/server/services/prontuario'
import { encaminhamentosAceitosDoPet } from '@/server/services/encaminhamentos'

/** GET /pets/:id/prontuario (tutor dono, vets e clínicas que atendem o pet, destinos de encaminhamento) */
export const GET = route<{ id: string }>(async (req, { id }) => {
  const user = await requireUser(await ApiRequest.from(req), ['tutor', 'veterinario', 'clinica', 'prestador'])
  const pet = await assertAcessoProntuario(user, id)
  const [consultas, encaminhamentos] = await Promise.all([prontuarioDoPet(pet.id), encaminhamentosAceitosDoPet(pet.id)])
  return ok({ pet: serializePetProntuario(pet), consultas, encaminhamentos })
})
