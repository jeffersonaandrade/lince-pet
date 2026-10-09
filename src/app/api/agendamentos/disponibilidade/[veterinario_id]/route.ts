import { DateTime } from 'luxon'
import { prisma } from '@/server/db'
import { ApiRequest, badRequest, ok, route, serverError } from '@/server/http'
import { requireUser } from '@/server/auth/session'

/** GET /agendamentos/disponibilidade/:veterinario_id */
export const GET = route<{ veterinario_id: string }>(async (req, { veterinario_id }) => {
  const apiReq = await ApiRequest.from(req)
  await requireUser(apiReq)
  try {
    const { data } = apiReq.qs()

    if (!data) {
      return badRequest({ message: 'Parâmetro data é obrigatório (formato: YYYY-MM-DD)' })
    }

    const agendamentosExistentes = await prisma.agendamento.findMany({
      where: {
        veterinarioId: veterinario_id,
        dataConsulta: DateTime.fromISO(data).toSQLDate(),
        status: { in: ['pendente', 'confirmado'] },
      },
      select: { horarioConsulta: true },
    })

    const horariosOcupados = agendamentosExistentes.map((a) => a.horarioConsulta)

    return ok({ data, horarios_ocupados: horariosOcupados })
  } catch (error) {
    console.error('Erro ao verificar disponibilidade:', error)
    return serverError({ message: 'Erro interno do servidor ao verificar disponibilidade' })
  }
})
