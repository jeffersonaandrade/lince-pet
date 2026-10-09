import { ApiRequest, json, notFound, route, serverError } from '@/server/http'
import { requireUser } from '@/server/auth/session'
import { getVeterinarioById } from '@/server/services/veterinarios'
import { deleteVeterinario } from '@/server/services/onboarding'

export const GET = route<{ id: string }>(async (_req, { id }) => {
  try {
    const veterinario = await getVeterinarioById(id)
    return json({ veterinario })
  } catch (error) {
    console.error('❌ [VeterinariosController] Erro ao buscar veterinário público:', (error as Error).message)
    if ((error as { status?: number }).status === 404) {
      return notFound({ message: 'Veterinário não encontrado' })
    }
    return serverError({ message: 'Erro interno do servidor' })
  }
})

// O parâmetro (:veterinarioId no Adonis) é ignorado: remove o veterinário do próprio usuário.
export const DELETE = route(async (req) => {
  const currentUser = await requireUser(await ApiRequest.from(req), ['clinica'])
  return json(await deleteVeterinario(currentUser))
})
