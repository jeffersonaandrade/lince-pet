import { prisma } from '@/server/db'
import { ok, route } from '@/server/http'

export const GET = route(async () => {
  const planos = await prisma.plano.findMany({ where: { ativo: 1 }, orderBy: { name: 'asc' } })
  return ok(planos)
})
