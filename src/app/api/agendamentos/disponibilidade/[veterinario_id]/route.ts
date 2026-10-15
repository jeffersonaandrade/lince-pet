import { DateTime } from 'luxon'
import { prisma } from '@/server/db'
import { ApiRequest, badRequest, ok, route, serverError } from '@/server/http'
import { requireUser } from '@/server/auth/session'
import { bloqueiosDoPeriodo, diaInteiroBloqueado, horariosBloqueadosNaData } from '@/server/services/bloqueios'

/** GET /agendamentos/disponibilidade/:veterinario_id */
export const GET = route<{ veterinario_id: string }>(async (req, { veterinario_id }) => {
  const apiReq = await ApiRequest.from(req)
  await requireUser(apiReq)
  try {
    const data = apiReq.text('data')
    const dataSql = data ? DateTime.fromISO(data).toSQLDate() : null

    if (!data || !dataSql) {
      return badRequest({ message: 'Parâmetro data é obrigatório (formato: YYYY-MM-DD)' })
    }

    const [agendamentosExistentes, bloqueios] = await Promise.all([
      prisma.agendamento.findMany({
        where: {
          veterinarioId: veterinario_id,
          dataConsulta: dataSql,
          status: { in: ['pendente', 'confirmado'] },
        },
        select: { horarioConsulta: true },
      }),
      bloqueiosDoPeriodo(veterinario_id, dataSql),
    ])

    const horariosBloqueados = horariosBloqueadosNaData(bloqueios, dataSql)
    const horariosOcupados = [
      ...new Set([...agendamentosExistentes.map((a) => a.horarioConsulta), ...horariosBloqueados]),
    ]

    return ok({
      data,
      horarios_ocupados: horariosOcupados,
      horarios_bloqueados: horariosBloqueados,
      dia_bloqueado: diaInteiroBloqueado(bloqueios, dataSql),
    })
  } catch (error) {
    console.error('Erro ao verificar disponibilidade:', error)
    return serverError({ message: 'Erro interno do servidor ao verificar disponibilidade' })
  }
})
