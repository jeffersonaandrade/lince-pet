import { after } from 'next/server'
import { DateTime } from 'luxon'
import { prisma } from '@/server/db'
import { ApiRequest, badRequest, HttpError, json, notFound, ok, route, serverError, unauthorized } from '@/server/http'
import { updating } from '@/server/lucid'
import { requireUser } from '@/server/auth/session'
import { inAppNotifications } from '@/server/services/in-app-notifications'
import { notifications } from '@/server/services/notifications'
import { notificarAgendamento } from '@/server/services/whatsapp-notificacoes'
import { podeEnviarEmail } from '@/server/services/canais-notificacao'
import { googleCalendar } from '@/server/services/google-calendar'
import { textoDoBairro, textoLocal, ehDomicilioDoTutor } from '@/lib/endereco-domicilio'
import { nomeCompleto, podeSerCancelado, prepareDataConsulta } from '@/server/services/agendamentos'
import { horarioEstaBloqueado, MENSAGEM_HORARIO_BLOQUEADO } from '@/server/services/bloqueios'
import { ehPedidoDePrestador, remarcarPedido } from '@/server/services/pedidos-prestador'
import { ehAgendamentoDeExame, remarcarExame } from '@/server/services/exames'
import { conferirPetAtivo } from '@/server/services/pets'
import { bloquearAgenda, horarioCanonico } from '@/server/services/agenda-lock'
import { conferirConsultaVeterinaria, camposDaConsulta } from '@/server/services/agenda-profissional'

/** PATCH /agendamentos/:id/reagendar */
export const PATCH = route<{ id: string }>(async (req, { id }) => {
  const apiReq = await ApiRequest.from(req)
  const user = await requireUser(apiReq)
  if (user.userType !== 'tutor') throw new HttpError(403, { message: 'Troque para o perfil de tutor para remarcar.' })
  if (!user) {
    return unauthorized({ message: 'Usuário não autenticado' })
  }

  const tutor = await prisma.tutor.findFirst({ where: { userId: user.id } })
  if (!tutor) {
    return badRequest({ message: 'Usuário não é um tutor válido' })
  }

  if (await ehPedidoDePrestador(id, tutor.id)) {
    const pedido = await remarcarPedido(tutor.id, id, apiReq.body)
    return ok({ message: 'Pedido remarcado. Aguarde o profissional aceitar novamente.', agendamento: pedido })
  }
  if (await ehAgendamentoDeExame(id, tutor.id)) {
    const exame = await remarcarExame(tutor.id, id, apiReq.body)
    return ok({ message: 'Exame remarcado com sucesso', agendamento: exame })
  }

  const data_consulta = apiReq.text('data_consulta')
  const horario_consulta = apiReq.text('horario_consulta')

  if (!data_consulta || !horario_consulta) {
    return badRequest({ message: 'Campos obrigatórios: data_consulta e horario_consulta' })
  }

  const dataConsultaObj = DateTime.fromISO(data_consulta)
  const hoje = DateTime.now().startOf('day')

  if (!dataConsultaObj.isValid) {
    return badRequest({ message: 'Data inválida (formato: YYYY-MM-DD)' })
  }
  if (dataConsultaObj < hoje) {
    return badRequest({ message: 'Não é possível reagendar consultas para datas passadas' })
  }

  const horario = horario_consulta
  if (!horarioCanonico(horario)) return badRequest({ message: 'Horário inválido. Use HH:mm.' })

  try {
    const result = await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`inicio:${id}`}, 0))`
      const agendamento = await tx.agendamento.findFirst({ where: { id, tutorId: tutor.id } })

      if (!agendamento) {
        return notFound({ message: 'Agendamento não encontrado' })
      }

      if (agendamento.petId) await conferirPetAtivo(tx, agendamento.petId)
      if (agendamento.veterinarioId) await bloquearAgenda(tx, 'veterinario', agendamento.veterinarioId)
      // O estado pode ter mudado enquanto aguardávamos o lock.
      const atual = await tx.agendamento.findUnique({ where: { id: agendamento.id } })
      if (!atual || !podeSerCancelado(atual.status)) return badRequest({ message: 'Este agendamento não pode ser reagendado' })
      const vet = await tx.veterinario.findUnique({ where: { id: agendamento.veterinarioId! } })
      if (!vet) return notFound({ message: 'Veterinário não encontrado' })
      let enderecoId = atual.veterinarioEnderecoId
      if (atual.tipoConsulta === 'presencial' && !enderecoId) {
        const endereco = await tx.veterinarioEndereco.findFirst({ where: {
          veterinarioId: vet.id, ativo: 1,
          ...(atual.clinicaId ? { clinicaId: atual.clinicaId } : { nomeClinica: atual.localNome }),
        } })
        if (!endereco) return badRequest({ message: 'O endereço original não está disponível para remarcação.' })
        enderecoId = endereco.id
      }
      const periodo = await conferirConsultaVeterinaria(tx, vet, dataConsultaObj.toISODate()!, horario, atual.tipoConsulta, enderecoId ? String(enderecoId) : null, id, atual.duracaoMin)

      const agendamentoExistente = await tx.agendamento.findFirst({
        where: {
          veterinarioId: agendamento.veterinarioId,
          dataConsulta: dataConsultaObj.toSQLDate(),
          horarioConsulta: horario,
          id: { not: agendamento.id },
          status: { in: ['pendente', 'confirmado', 'em andamento'] },
        },
      })

      if (agendamentoExistente) {
        return badRequest({ message: 'O novo horário já está ocupado. Escolha outro horário.' })
      }

      if (
        agendamento.veterinarioId &&
        (await horarioEstaBloqueado(agendamento.veterinarioId, dataConsultaObj.toSQLDate()!, horario))
      ) {
        return badRequest({ message: MENSAGEM_HORARIO_BLOQUEADO })
      }

      return tx.agendamento.update({
        where: { id: agendamento.id },
        data: updating({
          dataConsulta: prepareDataConsulta(dataConsultaObj),
          horarioConsulta: horario,
          status: 'pendente',
          ...camposDaConsulta(periodo),
        }),
      })
    })

    if (result instanceof Response) return result
    const agendamento = result
    const data = dataConsultaObj.toFormat('dd/MM/yyyy')

    after(() => notificarAgendamento('remarcacao', agendamento.id, ['tutor', 'profissional']))
    after(() => googleCalendar.sincronizarEvento(agendamento.id, 'atualizar'))

    try {
      const veterinario = agendamento.veterinarioId
        ? await prisma.veterinario.findFirst({ where: { id: agendamento.veterinarioId }, include: { user: true } })
        : null
      const vetUser = veterinario!.user!

      if (podeEnviarEmail(user)) {
        await notifications.sendAppointmentRescheduled(user.email, {
          nomeTutor: user.nome,
          nomeVeterinario: nomeCompleto(vetUser),
          data,
          horario: agendamento.horarioConsulta,
          tipo: agendamento.tipoConsulta,
          localNome: agendamento.localNome,
          verificationCode: agendamento.startCode || '',
        })
      }

      if (podeEnviarEmail(vetUser)) {
        await notifications.sendAppointmentRescheduledToVeterinarian(vetUser.email, {
          nomeVeterinario: nomeCompleto(vetUser),
          nomeTutor: nomeCompleto(user),
          data,
          horario: agendamento.horarioConsulta,
          tipo: agendamento.tipoConsulta,
          localNome: ehDomicilioDoTutor(agendamento) ? textoLocal(agendamento, 'profissional') : agendamento.localNome,
        })
      }

      await inAppNotifications.notifyAppointmentRescheduledToVet({
        veterinarioUserId: vetUser.id,
        tutorNome: nomeCompleto(user),
        dataConsulta: data,
        horarioConsulta: agendamento.horarioConsulta!,
        agendamentoId: agendamento.id,
        regiao: agendamento.tipoConsulta === 'domicilio' ? textoDoBairro(agendamento.localBairro) : null,
      })
      await inAppNotifications.notifyAppointmentRescheduledToTutor({
        tutorUserId: user.id,
        veterinarioNome: nomeCompleto(vetUser),
        dataConsulta: data,
        horarioConsulta: agendamento.horarioConsulta!,
        agendamentoId: agendamento.id,
      })
    } catch (notifError) {
      console.error('❌ Erro ao notificar reagendamento:', notifError)
    }

    return ok({
      message: 'Agendamento reagendado com sucesso',
      agendamento: {
        id: agendamento.id,
        data_consulta: data,
        horario_consulta: agendamento.horarioConsulta,
        status: agendamento.status,
      },
    })
  } catch (error) {
    if (error instanceof HttpError) return json(error.body, error.status)
    console.error('Erro ao reagendar agendamento:', error)
    return serverError({ message: 'Erro interno do servidor ao reagendar agendamento' })
  }
})
