import { prisma } from '@/server/db'
import { ApiRequest, notFound, ok, route } from '@/server/http'
import { requireUser } from '@/server/auth/session'

/** DELETE /veterinarios/bloqueios/:id */
export const DELETE = route<{ id: string }>(async (req, { id }) => {
  const user = await requireUser(await ApiRequest.from(req), ['veterinario'])
  if (!user.veterinario) return notFound({ message: 'Veterinário não encontrado' })

  const { count } = await prisma.bloqueioAgenda.deleteMany({ where: { id, veterinarioId: user.veterinario.id } })
  if (!count) return notFound({ message: 'Bloqueio não encontrado' })
  return ok({ message: 'Bloqueio removido com sucesso' })
})
