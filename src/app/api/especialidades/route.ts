import { prisma } from '@/server/db'
import { json, route } from '@/server/http'

export const GET = route(async () => {
  try {
    const especialidades = await prisma.especialidade.findMany({
      where: { ativo: 1 },
      orderBy: { nome: 'asc' },
      select: { id: true, nome: true },
    })
    return json({ success: true, data: especialidades })
  } catch {
    return json({ success: false, message: 'Erro ao buscar especialidades' }, 500)
  }
})
