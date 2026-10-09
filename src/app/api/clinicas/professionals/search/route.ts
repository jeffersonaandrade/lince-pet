import { prisma } from '@/server/db'
import { ApiRequest, ok, route, serverError } from '@/server/http'
import { requireUser } from '@/server/auth/session'
import { serializeRelatedUser } from '@/server/services/clinicas'

export const GET = route(async (req) => {
  const request = await ApiRequest.from(req)
  await requireUser(request)
  const { search } = request.qs()

  try {
    let vets
    if (search) {
      const like = `%${search}%`
      const rows = await prisma.$queryRaw<{ id: string }[]>`
        SELECT v.id FROM veterinarios v
        WHERE (
          EXISTS (
            SELECT 1 FROM users u
            WHERE v.user_id = u.id
              AND (CONCAT(u.nome, ' ', u.sobrenome) LIKE ${like} OR u.nome LIKE ${like} OR u.sobrenome LIKE ${like})
          )
          OR v.crmv LIKE ${like}
        )
        LIMIT 40
      `
      const ids = rows.map((r) => r.id)
      const found = await prisma.veterinario.findMany({ where: { id: { in: ids } }, include: { user: true } })
      vets = ids.map((id) => found.find((v) => v.id === id)!).filter(Boolean)
    } else {
      vets = await prisma.veterinario.findMany({ take: 40, include: { user: true } })
    }

    console.log(`[SEARCH DEBUG] Termo: "${search}" | Encontrados: ${vets.length}`)

    return ok({ profissionais: vets.map(({ user, ...vet }) => ({ ...vet, user: serializeRelatedUser(user) })) })
  } catch (error) {
    console.error(error)
    return serverError({ message: 'Erro ao pesquisar veterinários' })
  }
})
