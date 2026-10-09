import { prisma } from '@/server/db'
import { ok, route } from '@/server/http'

export const GET = route(async () => {
  const planos = await prisma.plano.findMany({ orderBy: { name: 'asc' } })
  return ok(planos)
})
