import { ApiRequest, badRequest, notFound, ok, route, serverError } from '@/server/http'
import { requireUser } from '@/server/auth/session'
import { prisma } from '@/server/db'
import { updating } from '@/server/lucid'
import { findEnderecoPrincipalOuAtivo, findVeterinarioByUser, toJsonColumn } from '@/server/services/veterinarios'

const diaSemanaMap: Record<string, number> = {
  domingo: 0,
  segunda: 1,
  terca: 2,
  quarta: 3,
  quinta: 4,
  sexta: 5,
  sabado: 6,
}

const diaSemanaReverseMap: Record<number, string> = {
  0: 'domingo',
  1: 'segunda',
  2: 'terca',
  3: 'quarta',
  4: 'quinta',
  5: 'sexta',
  6: 'sabado',
}

export const GET = route(async (req) => {
  const currentUser = await requireUser(await ApiRequest.from(req), ['veterinario'])
  try {
    const veterinario = await findVeterinarioByUser(currentUser.id)
    if (!veterinario) {
      return notFound({ message: 'Veterinário não encontrado' })
    }

    const endereco = await findEnderecoPrincipalOuAtivo(veterinario.id)
    const horariosObj = (endereco?.horariosDisponibilidade || {}) as Record<string, unknown>

    const horarios: { diaSemana: number; horaInicio: string; horaFim: string; ativo: boolean }[] = []
    Object.entries(horariosObj).forEach(([dia, times]) => {
      if (Array.isArray(times) && diaSemanaMap[dia] !== undefined) {
        times.forEach((time) => {
          if (typeof time === 'string') {
            horarios.push({ diaSemana: diaSemanaMap[dia], horaInicio: time, horaFim: time, ativo: true })
          }
        })
      }
    })

    return ok({ horarios })
  } catch (error) {
    console.error('❌ [Get Schedule] Erro:', error)
    return serverError({ message: 'Erro ao buscar horários' })
  }
})

export const PUT = route(async (req) => {
  const apiReq = await ApiRequest.from(req)
  const currentUser = await requireUser(apiReq, ['veterinario'])
  try {
    const veterinario = await findVeterinarioByUser(currentUser.id)
    if (!veterinario) {
      return notFound({ message: 'Veterinário não encontrado' })
    }

    const { horarios } = apiReq.only(['horarios'])
    if (!Array.isArray(horarios)) {
      return badRequest({ message: 'Formato de horários inválido' })
    }

    const endereco = await findEnderecoPrincipalOuAtivo(veterinario.id)
    if (!endereco) {
      return notFound({ message: 'Nenhum endereço encontrado para salvar os horários.' })
    }

    const horariosObj: Record<string, string[]> = {
      domingo: [],
      segunda: [],
      terca: [],
      quarta: [],
      quinta: [],
      sexta: [],
      sabado: [],
    }

    const horariosList = horarios as { diaSemana: number; horaInicio: string; horaFim: string; ativo: boolean }[]
    horariosList.forEach((h) => {
      if (h.ativo && diaSemanaReverseMap[h.diaSemana]) {
        horariosObj[diaSemanaReverseMap[h.diaSemana]].push(h.horaInicio)
      }
    })

    Object.keys(horariosObj).forEach((key) => {
      horariosObj[key].sort()
    })

    await prisma.veterinarioEndereco.update({
      where: { id: endereco.id },
      data: updating({ horariosDisponibilidade: toJsonColumn(horariosObj) }),
    })

    return ok({ message: 'Horários atualizados com sucesso' })
  } catch (error) {
    console.error('❌ [Update Schedule] Erro:', error)
    return serverError({ message: 'Erro ao atualizar horários' })
  }
})
