import { prisma } from '@/server/db'
import { ApiRequest, ok, route, serverError, unauthorized } from '@/server/http'
import { requireUser } from '@/server/auth/session'
import { mysqlDateTime } from '@/server/services/clinicas'

export const GET = route(async (req) => {
  const currentUser = await requireUser(await ApiRequest.from(req))
  if (!currentUser.clinica) {
    return unauthorized({ message: 'Usuário não autenticado ou não é clínica' })
  }

  try {
    const clinicaId = currentUser.clinica.id

    const startOfDay = new Date()
    startOfDay.setHours(0, 0, 0, 0)
    const endOfDay = new Date()
    endOfDay.setHours(23, 59, 59, 999)

    const startOfWeek = new Date()
    startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay())
    const endOfWeek = new Date()
    endOfWeek.setDate(endOfWeek.getDate() + (6 - endOfWeek.getDay()))

    const startOfMonth = new Date(startOfDay.getFullYear(), startOfDay.getMonth(), 1)
    const endOfMonth = new Date(startOfDay.getFullYear(), startOfDay.getMonth() + 1, 0)

    const countBetween = (from: Date, to: Date) =>
      prisma.agendamento.count({
        where: { clinicaId, dataConsulta: { gte: mysqlDateTime(from), lte: mysqlDateTime(to) } },
      })

    const stats = {
      agendamentosHoje: await countBetween(startOfDay, endOfDay),
      agendamentosSemana: await countBetween(startOfWeek, endOfWeek),
      agendamentosMes: await countBetween(startOfMonth, endOfMonth),
      totalClientes: await prisma.$queryRaw<{ total: bigint | number }[]>`
        SELECT COUNT(DISTINCT tutor_id) AS total FROM agendamentos WHERE clinica_id = ${clinicaId}
      `.then((res) => Number(res[0].total)),
    }

    return ok(stats)
  } catch (error) {
    console.error(error)
    return serverError({ message: 'Erro ao buscar estatísticas' })
  }
})
