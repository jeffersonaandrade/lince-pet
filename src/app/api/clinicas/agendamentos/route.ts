import type { Prisma } from '@prisma/client'
import { prisma } from '@/server/db'
import { ApiRequest, ok, route, serverError, unauthorized } from '@/server/http'
import { requireUser } from '@/server/auth/session'
import { formatDataConsulta } from '@/server/services/clinicas'

export const GET = route(async (req) => {
  const request = await ApiRequest.from(req)
  const currentUser = await requireUser(request)
  if (!currentUser.clinica) {
    return unauthorized({ message: 'Usuário não autenticado ou não é clínica' })
  }

  try {
    const { data_inicio, data_fim, status } = request.qs()
    const where: Prisma.AgendamentoWhereInput = { clinicaId: currentUser.clinica.id }
    const dataConsulta: Prisma.StringNullableFilter = {}

    if (data_inicio) dataConsulta.gte = data_inicio
    if (data_fim) dataConsulta.lte = data_fim
    if (data_inicio || data_fim) where.dataConsulta = dataConsulta

    if (status) {
      const statuses: string[] =
        typeof status === 'string' ? status.split(',') : Array.isArray(status) ? status : [status]
      where.status = { in: statuses }
    }

    const agendamentos = await prisma.agendamento.findMany({
      where,
      include: {
        tutor: { include: { user: true } },
        pet: true,
        veterinario: { include: { user: true } },
      },
      orderBy: [{ dataConsulta: 'asc' }, { horarioConsulta: 'asc' }],
    })

    const formatted = agendamentos.map((a) => ({
      id: a.id,
      tutor_nome: a.tutor?.user?.nome || 'Tutor',
      tutor_sobrenome: a.tutor?.user?.sobrenome || '',
      pet_nome: a.pet?.nome || 'Pet',
      pet_raca: a.pet?.raca || '',
      pet_porte: a.pet?.porte || '',
      pet_especie: a.pet?.especie || '',
      pet_foto_url: a.pet?.fotoUrl || null,
      veterinario_nome: a.veterinario?.user?.nome || 'Veterinário',
      veterinario_sobrenome: a.veterinario?.user?.sobrenome || '',
      data_consulta: formatDataConsulta(a.dataConsulta),
      horario_consulta: a.horarioConsulta,
      tipo_consulta: a.tipoConsulta,
      status: a.status,
      local_nome: a.localNome,
      local_endereco: a.localEndereco,
      valor_total: a.precoConsulta,
      observacoes: a.observacoes,
    }))

    return ok({ agendamentos: formatted })
  } catch (error) {
    console.error(error)
    return serverError({ message: 'Erro ao buscar agendamentos' })
  }
})
