import { prisma } from '@/server/db'
import { ok, route } from '@/server/http'

export const GET = route(async () => {
  const plans = await prisma.subscriptionPlan.findMany({ where: { active: 1 } })
  return ok({ plans })
})
