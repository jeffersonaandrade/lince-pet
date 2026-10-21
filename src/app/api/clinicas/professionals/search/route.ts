import { prisma } from '@/server/db'
import { ApiRequest, ok, route, serverError } from '@/server/http'
import { requireUser } from '@/server/auth/session'
import { usuarioPublico, veterinarioPublico } from '@/server/services/clinicas'

export const GET = route(async (req) => {
  const request = await ApiRequest.from(req)
  await requireUser(request, ['clinica'])
  const search = request.text('search')

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
              AND (CONCAT(u.nome, ' ', u.sobrenome) ILIKE ${like} OR u.nome ILIKE ${like} OR u.sobrenome ILIKE ${like})
          )
          OR v.crmv ILIKE ${like}
        )
        LIMIT 40
      `
      const ids = rows.map((r) => r.id)
      const found = await prisma.veterinario.findMany({ where: { id: { in: ids } }, include: { user: true } })
      vets = ids.map((id) => found.find((v) => v.id === id)!).filter(Boolean)
    } else {
      vets = await prisma.veterinario.findMany({ take: 40, include: { user: true } })
    }

    // A clínica vê o e-mail para identificar o profissional antes de convidar; celular e endereço ficam de fora.
    return ok({
      profissionais: vets.map(({ user, ...vet }) => ({
        ...veterinarioPublico(vet),
        user: user ? { ...usuarioPublico(user), email: user.email } : null,
      })),
    })
  } catch (error) {
    console.error(error)
    return serverError({ message: 'Erro ao pesquisar veterinários' })
  }
})
