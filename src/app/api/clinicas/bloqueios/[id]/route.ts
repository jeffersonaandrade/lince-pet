import { prisma } from '@/server/db'
import { ApiRequest, notFound, ok, route, unauthorized } from '@/server/http'
import { requireUser } from '@/server/auth/session'
import { assertVinculoAceito } from '@/server/services/bloqueios'

/** DELETE /clinicas/bloqueios/:id */
export const DELETE = route<{ id: string }>(async (req, { id }) => {
  const user = await requireUser(await ApiRequest.from(req), ['clinica'])
  if (!user.clinica) return unauthorized({ message: 'Usuário não autenticado ou não é clínica' })

  const bloqueio = await prisma.bloqueioAgenda.findUnique({ where: { id } })
  if (!bloqueio?.veterinarioId) return notFound({ message: 'Bloqueio não encontrado' })
  await assertVinculoAceito(user.clinica.id, bloqueio.veterinarioId)

  await prisma.bloqueioAgenda.delete({ where: { id } })
  return ok({ message: 'Bloqueio removido com sucesso' })
})
