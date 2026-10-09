import { prisma } from '@/server/db'
import { ApiRequest, forbidden, noContent, notFound, route } from '@/server/http'
import { requireUser } from '@/server/auth/session'

export const DELETE = route<{ id: string }>(async (req, { id }) => {
  const user = await requireUser(await ApiRequest.from(req), ['tutor'])
  const tutor = await prisma.tutor.findFirst({ where: { userId: user.id } })
  if (!tutor) return notFound({ message: 'Tutor profile not found' })

  const favorite = await prisma.favorite.findUnique({ where: { id } })
  if (!favorite) return notFound({ message: 'Favorite not found' })
  if (favorite.tutorId !== tutor.id) {
    return forbidden({ message: 'You are not authorized to remove this favorite' })
  }

  await prisma.favorite.delete({ where: { id } })
  return noContent()
})
