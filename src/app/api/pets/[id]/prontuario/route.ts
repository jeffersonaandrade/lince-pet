import { ApiRequest, ok, route } from '@/server/http'
import { requireUser } from '@/server/auth/session'
import { assertAcessoProntuario, prontuarioDoPet, serializePetProntuario } from '@/server/services/prontuario'

/** GET /pets/:id/prontuario (tutor dono, vets e clínicas que atendem o pet) */
export const GET = route<{ id: string }>(async (req, { id }) => {
  const user = await requireUser(await ApiRequest.from(req), ['tutor', 'veterinario', 'clinica'])
  const pet = await assertAcessoProntuario(user, id)
  return ok({ pet: serializePetProntuario(pet), consultas: await prontuarioDoPet(pet.id) })
})
