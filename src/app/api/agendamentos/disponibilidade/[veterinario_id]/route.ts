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
    const { data } = apiReq.qs()

    if (!data) {
      return badRequest({ message: 'Parâmetro data é obrigatório (formato: YYYY-MM-DD)' })
    }

    const dataSql = DateTime.fromISO(data).toSQLDate()
    const [agendamentosExistentes, bloqueios] = await Promise.all([
      prisma.agendamento.findMany({
        where: {
          veterinarioId: veterinario_id,
          dataConsulta: dataSql,
          status: { in: ['pendente', 'confirmado'] },
        },
        select: { horarioConsulta: true },
      }),
      dataSql ? bloqueiosDoPeriodo(veterinario_id, dataSql) : [],
    ])

    const horariosBloqueados = dataSql ? horariosBloqueadosNaData(bloqueios, dataSql) : []
    const horariosOcupados = [
      ...new Set([...agendamentosExistentes.map((a) => a.horarioConsulta), ...horariosBloqueados]),
    ]

    return ok({
      data,
      horarios_ocupados: horariosOcupados,
      horarios_bloqueados: horariosBloqueados,
      dia_bloqueado: dataSql ? diaInteiroBloqueado(bloqueios, dataSql) : false,
    })
  } catch (error) {
    console.error('Erro ao verificar disponibilidade:', error)
    return serverError({ message: 'Erro interno do servidor ao verificar disponibilidade' })
  }
})
