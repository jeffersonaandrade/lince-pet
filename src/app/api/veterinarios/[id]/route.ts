import { ApiRequest, json, notFound, route, serverError } from '@/server/http'
import { requireUser } from '@/server/auth/session'
import { getVeterinarioById } from '@/server/services/veterinarios'
import { removerDaEquipe } from '@/server/services/clinica-equipe'

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

/** Clínica remove o veterinário da equipe (desfaz o vínculo, não apaga a conta). */
export const DELETE = route<{ id: string }>(async (req, { id }) => {
  const currentUser = await requireUser(await ApiRequest.from(req), ['clinica'])
  if (!currentUser.clinica) return notFound({ message: 'Clínica não encontrada' })
  await removerDaEquipe(currentUser.clinica.id, id)
  return json({ success: true, message: 'Veterinário removido com sucesso' })
})
