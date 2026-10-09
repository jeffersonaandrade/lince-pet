import { ApiRequest, ok, route } from '@/server/http'
import { requireUser } from '@/server/auth/session'
import { listarDoTutor } from '@/server/services/encaminhamentos'

/** GET /tutor/encaminhamentos */
export const GET = route(async (req) => {
  const user = await requireUser(await ApiRequest.from(req), ['tutor'])
  if (!user.tutor) return ok({ data: [] })
  return ok({ data: await listarDoTutor(user.tutor.id) })
})
