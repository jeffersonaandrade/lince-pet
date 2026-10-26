import { after } from 'next/server'
import { DateTime } from 'luxon'
import { randomInt } from 'node:crypto'
import type { Prisma } from '@/generated/prisma/client'
import { prisma } from '@/server/db'
import { ApiRequest, badRequest, created, HttpError, json, notFound, ok, route, serverError, unauthorized } from '@/server/http'
import { conferirEncaminhamento, vincularAgendamento } from '@/server/services/encaminhamentos'
import { creating, updating } from '@/server/lucid'
import { requireUser } from '@/server/auth/session'
import { canCreateAppointment } from '@/server/services/subscription'
import { inAppNotifications } from '@/server/services/in-app-notifications'
import { notifications } from '@/server/services/notifications'
import { notificarAgendamento } from '@/server/services/whatsapp-notificacoes'
import { podeEnviarEmail } from '@/server/services/canais-notificacao'
import { horarioEstaBloqueado, MENSAGEM_HORARIO_BLOQUEADO } from '@/server/services/bloqueios'
import { descreverPeriodo } from '@/server/services/pedidos-prestador'
import { APROVADO, MENSAGEM_CRMV_EM_ANALISE } from '@/server/services/aprovacoes'
import { bloquearAgenda, horarioCanonico } from '@/server/services/agenda-lock'
import { conferirPetAtivo } from '@/server/services/pets'
import { conferirConsultaVeterinaria, camposDaConsulta } from '@/server/services/agenda-profissional'
import { textoDoBairro, textoLocal, ehDomicilioDoTutor } from '@/lib/endereco-domicilio'
import {
  consumeDataConsulta,
  jaPassou,
  nomeCompleto,
  podeSerCancelado,
  prepareDataConsulta,
} from '@/server/services/agendamentos'

/** POST /agendamentos */
export const POST = route(async (req) => {
  const apiReq = await ApiRequest.from(req)
  const user = await requireUser(apiReq)
  if (user.userType !== 'tutor') throw new HttpError(403, { message: 'Troque para o perfil de tutor para agendar.' })
  try {
    console.log('🎯 [Agendamento] Iniciando criação de agendamento...')
    console.log('👤 [Agendamento] Usuário:', user ? user.id : 'não autenticado')

    if (!user) {
      return unauthorized({ message: 'Usuário não autenticado' })
    }

    const tutor = await prisma.tutor.findFirst({ where: { userId: user.id } })
    console.log('🐕 [Agendamento] Tutor encontrado:', tutor ? tutor.id : 'não encontrado')

    if (!tutor) {
      return badRequest({ message: 'Apenas Tutores podem agendar consultas' })
    }

    const [
      veterinario_id,
      data_consulta,
      horario_consulta,
      tipo_consulta,
      observacoes,
      pet_id,
      endereco_id,
      clinica_id,
      encaminhamento_id,
    ] = [
      'veterinario_id',
      'data_consulta',
      'horario_consulta',
      'tipo_consulta',
      'observacoes',
      'pet_id',
      'endereco_id',
      'clinica_id',
      'encaminhamento_id',
    ].map((campo) => apiReq.text(campo))

    if (!veterinario_id || !data_consulta || !horario_consulta || !tipo_consulta) {
      return badRequest({
        message: 'Campos obrigatórios: veterinario_id, data_consulta, horario_consulta, tipo_consulta',
      })
    }

    if (!pet_id) {
      return badRequest({ message: 'Selecione um pet para a consulta' })
    }

    if (!horarioCanonico(horario_consulta)) return badRequest({ message: 'Horário inválido. Use HH:mm.' })

    const pet = await prisma.pet.findFirst({ where: { id: pet_id, tutorId: tutor.id, arquivadoEm: null } })
    if (!pet) {
      return badRequest({ message: 'Pet inválido para este tutor' })
    }

    const veterinario = await prisma.veterinario.findFirst({
      where: { id: veterinario_id },
      include: { user: true, enderecos: true },
    })

    if (!veterinario) {
      return notFound({ message: 'Veterinário não encontrado' })
    }
    if (veterinario.userId === user.id) return badRequest({ message: 'Não é possível agendar com seu próprio perfil profissional.' })
    if (veterinario.crmvStatus !== APROVADO) {
      return badRequest({ message: MENSAGEM_CRMV_EM_ANALISE })
    }

    let finalPrice: Prisma.Decimal | number = veterinario.precoConsulta || 0
    let localNome: string | null = null
    let localEndereco: string | null = null
    let localBairro: string | null = null
    let agendaEnderecoId = endereco_id
    if (tipo_consulta === 'presencial' && !endereco_id && !clinica_id) return badRequest({ message: 'Selecione um local de atendimento presencial.' })

    if (tipo_consulta === 'presencial' && endereco_id) {
      const selectedAddress = veterinario.enderecos.find((e) => e.id === endereco_id)
      if (selectedAddress && clinica_id && selectedAddress.clinicaId !== clinica_id) return badRequest({ message: 'O endereço selecionado não pertence à clínica informada.' })
      if (selectedAddress) {
        finalPrice = selectedAddress.precoConsulta || finalPrice
        localNome = selectedAddress.nomeClinica || 'Clínica'
        localEndereco = `${selectedAddress.rua}, ${selectedAddress.numero}${selectedAddress.bairro ? ` - ${selectedAddress.bairro}` : ''}, ${selectedAddress.cidade}`
      }
    } else if (tipo_consulta === 'domicilio') {
      finalPrice = veterinario.precoConsultaDomicilio || finalPrice
      localNome = 'Domicílio do tutor'
      if (!user.rua || !user.numero || !user.cidade || !user.estado) return badRequest({ message: 'Complete seu endereço no perfil de tutor para receber atendimento a domicílio.' })
      localBairro = user.bairro?.trim() || null
      localEndereco = [user.rua, user.numero, user.bairro, user.cidade, user.estado, user.cep].filter(Boolean).join(', ')
    } else if (tipo_consulta === 'online') {
      finalPrice = veterinario.precoConsultaOnline || finalPrice
      localNome = 'Teleconsulta'
      localEndereco = 'Atendimento Online'
    }

    let finalClinicaId: string | null = clinica_id || null
    if (tipo_consulta !== 'presencial' && (clinica_id || endereco_id)) return badRequest({ message: 'Clínica e endereço profissional só se aplicam a consulta presencial.' })
    const vinculoAceito = (clinicaId: string) =>
      prisma.veterinarioClinica.findFirst({
        where: { veterinarioId: veterinario.id, clinicaId, status: 'aceito' },
        select: { clinicaId: true },
      })

    if (clinica_id) {
      if (!(await vinculoAceito(clinica_id))) {
        return badRequest({ message: 'Este profissional não atende por esta clínica' })
      }
      const clinica = await prisma.clinica.findUnique({ where: { id: clinica_id } })
      if (clinica) {
        localNome = clinica.nomeClinica
        localEndereco = clinica.endereco

        const enderecoClinica = veterinario.enderecos.find((e) => e.clinicaId === clinica_id)
        if (!enderecoClinica) return badRequest({ message: 'Clínica sem endereço ativo de atendimento para este veterinário.' })
        if (enderecoClinica) {
          agendaEnderecoId = enderecoClinica.id
          finalPrice = enderecoClinica.precoConsulta
        }
      }
    } else if (tipo_consulta === 'presencial' && endereco_id) {
      const selectedAddress = veterinario.enderecos.find((e) => e.id === endereco_id)
      if (selectedAddress && selectedAddress.clinicaId) {
        // Endereço de clínica de um vínculo já desfeito não dá à clínica acesso ao agendamento (contato do tutor, prontuário).
        if (await vinculoAceito(selectedAddress.clinicaId)) finalClinicaId = selectedAddress.clinicaId
        finalPrice = selectedAddress.precoConsulta || finalPrice
      }
    }

    const dataConsulta = DateTime.fromISO(data_consulta)
    const hoje = DateTime.now().startOf('day')

    if (!dataConsulta.isValid) {
      return badRequest({ message: 'Data inválida (formato: YYYY-MM-DD)' })
    }
    if (dataConsulta < hoje) {
      return badRequest({ message: 'Não é possível agendar consultas em datas passadas' })
    }

    const agendamentoExistente = await prisma.agendamento.findFirst({
      where: {
        veterinarioId: veterinario_id,
        dataConsulta: dataConsulta.toSQLDate(),
        horarioConsulta: horario_consulta,
        status: { in: ['pendente', 'confirmado'] },
      },
    })

    if (agendamentoExistente) {
      return badRequest({ message: 'Horário já ocupado. Escolha outro horário.' })
    }

    if (await horarioEstaBloqueado(veterinario_id, dataConsulta.toSQLDate()!, horario_consulta)) {
      return badRequest({ message: MENSAGEM_HORARIO_BLOQUEADO })
    }

    const checkLimit = await canCreateAppointment(veterinario)
    if (!checkLimit.allowed) {
      return badRequest({ message: checkLimit.reason || 'Limite mensal de agendamentos atingido.' })
    }

    if (encaminhamento_id) {
      try {
        await conferirEncaminhamento(encaminhamento_id, {
          tutorId: tutor.id,
          petId: pet.id,
          veterinarioId: veterinario_id,
          clinicaId: finalClinicaId,
        })
      } catch (e) {
        if (e instanceof HttpError) return json(e.body, e.status)
        throw e
      }
    }

    let agendamento = await prisma.$transaction(async (tx) => {
      await conferirPetAtivo(tx, pet.id)
      await bloquearAgenda(tx, 'veterinario', veterinario_id)
      const configuracaoAtual = await tx.veterinario.findUnique({ where: { id: veterinario_id } })
      if (!configuracaoAtual) throw new HttpError(404, { message: 'Veterinário não encontrado' })
      const periodo = await conferirConsultaVeterinaria(tx, configuracaoAtual, dataConsulta.toISODate()!, horario_consulta, tipo_consulta, agendaEnderecoId)
      const ocupado = await tx.agendamento.findFirst({
        where: {
          veterinarioId: veterinario_id,
          dataConsulta: dataConsulta.toSQLDate(),
          horarioConsulta: horario_consulta,
          status: { in: ['pendente', 'confirmado', 'em andamento'] },
        },
      })
      if (ocupado) throw new HttpError(409, { message: 'Horário já ocupado. Escolha outro horário.' })
      const novo = await tx.agendamento.create({
        data: creating({
          tutorId: tutor.id,
          veterinarioId: veterinario_id,
          petId: pet.id,
          dataConsulta: prepareDataConsulta(dataConsulta),
          horarioConsulta: horario_consulta,
          tipoConsulta: tipo_consulta,
          precoConsulta: finalPrice,
          observacoes: observacoes || null,
          localNome,
          localEndereco,
          localBairro,
          clinicaId: finalClinicaId,
          status: 'pendente',
          ...camposDaConsulta(periodo),
        }),
      })

      const vetForUpdate = await tx.veterinario.findFirst({ where: { id: veterinario_id } })
      if (vetForUpdate) {
        await tx.veterinario.update({
          where: { id: vetForUpdate.id },
          data: updating({ monthlyAppointmentsUsed: (vetForUpdate.monthlyAppointmentsUsed ?? 0) + 1 }),
        })
      }
      return novo
    })

    if (encaminhamento_id) await vincularAgendamento(encaminhamento_id, agendamento.id)

    try {
      const startCode = randomInt(100000, 999999).toString()
      // Lucid grava 'yyyy-MM-dd HH:mm:ss' (sem ms); com ms o MySQL arredondaria para o dia seguinte.
      const expiresAt = dataConsulta.endOf('day').set({ millisecond: 0 }).toJSDate()
      agendamento = { ...agendamento, startCode, startCodeExpiresAt: expiresAt, startCodeAttempts: 0 }
      await prisma.agendamento.update({
        where: { id: agendamento.id },
        data: updating({ startCode, startCodeExpiresAt: expiresAt, startCodeAttempts: 0 }),
      })
    } catch (e) {
      console.error('Erro ao gerar/salvar start_code do agendamento:', e)
    }

    const vetUser = veterinario.user!
    const dataFormatada = dataConsulta.toFormat('dd/MM/yyyy')

    try {
      const tutorEmail = user.email
      const payload = {
        nomeTutor: user.nome,
        nomeVeterinario: nomeCompleto(vetUser),
        data: dataFormatada,
        horario: agendamento.horarioConsulta,
        tipo: agendamento.tipoConsulta,
        localNome: agendamento.localNome,
        observacoes: agendamento.observacoes,
      }

      if (podeEnviarEmail(user)) {
        const tutorEmailRes = await notifications.sendAppointmentConfirmation(
          tutorEmail,
          payload,
          agendamento.startCode || undefined
        )

        if (tutorEmailRes.success) {
          console.log('✅ [NotificationService] Email de confirmação enviado com sucesso')
        } else {
          console.error('❌ [NotificationService] Falha no envio de e-mail ao tutor:', tutorEmailRes.error)
        }
      }

      if (podeEnviarEmail(vetUser)) {
        const vetEmailRes = await notifications.sendNewAppointmentToVeterinarian(vetUser.email, {
          nomeVeterinario: nomeCompleto(vetUser),
          nomeTutor: nomeCompleto(user),
          data: dataFormatada,
          horario: agendamento.horarioConsulta,
          tipo: agendamento.tipoConsulta,
          localNome: ehDomicilioDoTutor(agendamento) ? textoLocal(agendamento, 'profissional') : agendamento.localNome,
          observacoes: agendamento.observacoes,
          contatoTutor: { email: user.email, celular: user.celular },
        })
        if (vetEmailRes.success) {
          console.log('✅ [NotificationService] Email ao veterinário enviado com sucesso')
        } else {
          console.error('❌ [NotificationService] Falha no envio de e-mail ao veterinário:', vetEmailRes.error)
        }
      }

      await inAppNotifications.notifyNewAppointmentToVet({
        veterinarioUserId: vetUser.id,
        tutorNome: nomeCompleto(user),
        dataConsulta: dataFormatada,
        horarioConsulta: agendamento.horarioConsulta!,
        agendamentoId: agendamento.id,
        regiao: tipo_consulta === 'domicilio' ? textoDoBairro(localBairro) : null,
      })
      await inAppNotifications.notifyAppointmentScheduledToTutor({
        tutorUserId: user.id,
        veterinarioNome: nomeCompleto(vetUser),
        dataConsulta: dataFormatada,
        horarioConsulta: agendamento.horarioConsulta!,
        agendamentoId: agendamento.id,
      })
      console.log('✅ [InAppNotification] Notificação criada com sucesso')
    } catch (e) {
      console.error('❌ [Agendamento] Erro crítico ao processar notificações:', e)
    }

    after(async () => {
      await notificarAgendamento('confirmacao', agendamento.id, ['tutor'])
      await notificarAgendamento('novo_agendamento', agendamento.id, ['profissional'])
    })

    const { googleCalendar } = await import('@/server/services/google-calendar')
    after(
      googleCalendar
        .createEventForAppointment({ ...agendamento, tutor, veterinario, pet })
        .catch((err) => console.error('[Google Calendar] Falha no fluxo assíncrono do calendário:', err.message))
    )

    return created({
      message: 'Agendamento criado com sucesso',
      agendamento: {
        id: agendamento.id,
        data_consulta: dataFormatada,
        horario_consulta: agendamento.horarioConsulta,
        tipo_consulta: agendamento.tipoConsulta,
        status: agendamento.status,
        preco_consulta: finalPrice,
        observacoes: agendamento.observacoes,
        local_nome: agendamento.localNome,
        local_endereco: agendamento.localEndereco,
        veterinario: {
          nome: vetUser.nome,
          crmv: veterinario.crmv,
        },
        tutor: {
          nome: user.nome,
        },
        pet: pet ? { nome: pet.nome } : null,
      },
    })
  } catch (error) {
    if (error instanceof HttpError) return json(error.body, error.status)
    console.error('❌ [Agendamento] Erro ao criar agendamento:', error)
    console.error('❌ [Agendamento] Stack:', (error as Error).stack)
    console.error('❌ [Agendamento] Detalhes:', JSON.stringify(error, null, 2))

    return serverError({
      message: 'Erro interno do servidor ao criar agendamento',
      error: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined,
      details: process.env.NODE_ENV === 'development' ? error : undefined,
    })
  }
})

/** GET /agendamentos */
export const GET = route(async (req) => {
  const apiReq = await ApiRequest.from(req)
  const user = await requireUser(apiReq, ['tutor'])
  try {
    if (!user) {
      return unauthorized({ message: 'Usuário não autenticado' })
    }

    const tutor = await prisma.tutor.findFirst({ where: { userId: user.id } })
    if (!tutor) {
      return badRequest({ message: 'Usuário não é um tutor válido' })
    }

    const { status, data_inicio, data_fim } = apiReq.qs()

    const where: Prisma.AgendamentoWhereInput = { tutorId: tutor.id }
    const dataFilters: Prisma.AgendamentoWhereInput[] = []
    if (status) where.status = String(status)

    let semResultados = false
    for (const [value, op] of [
      [data_inicio, 'gte'],
      [data_fim, 'lte'],
    ] as const) {
      if (!value) continue
      const sqlDate = DateTime.fromISO(String(value)).toSQLDate()
      // `data_consulta >= NULL` no MySQL não retorna nenhuma linha
      if (!sqlDate) semResultados = true
      else dataFilters.push({ dataConsulta: { [op]: sqlDate } })
    }
    if (dataFilters.length) where.AND = dataFilters

    const agendamentos = semResultados
      ? []
      : await prisma.agendamento.findMany({
          where,
          include: {
            veterinario: { include: { user: true } },
            prestador: { include: { user: true, tipoServico: true } },
            servicoOferecido: true,
            pet: true,
            clinica: true,
            exames: { select: { nome: true, preparo: true } },
            laudo: { select: { id: true } },
          },
          orderBy: [{ dataConsulta: 'desc' }, { horarioConsulta: 'asc' }],
        })

    const ids = agendamentos.map((a) => a.id)
    const avaliadosIds = ids.length
      ? (
          await prisma.avaliacao.findMany({
            where: { agendamentoId: { in: ids } },
            select: { agendamentoId: true },
          })
        ).map((r) => r.agendamentoId)
      : []
    const avaliadosSet = new Set(avaliadosIds)

    const agendamentosFormatados = agendamentos.map((agendamento) => {
      const dataConsulta = consumeDataConsulta(agendamento.dataConsulta)
      if (!agendamento.createdAt) throw new TypeError('createdAt nulo')
      const passou = jaPassou(dataConsulta, agendamento.horarioConsulta)
      const { veterinario, prestador } = agendamento
      // Pedido de prestador só mostra o código depois de aceito.
      const codigoVisivel =
        !passou &&
        !agendamento.startCodeUsedAt &&
        !['cancelado', 'cancelada'].includes(agendamento.status) &&
        (!prestador || agendamento.status === 'confirmado')
      return {
        id: agendamento.id,
        data_consulta: dataConsulta!.toFormat('dd/MM/yyyy'),
        horario_consulta: agendamento.horarioConsulta,
        tipo_consulta: agendamento.tipoConsulta,
        status: agendamento.status,
        preco_consulta: agendamento.precoConsulta,
        observacoes: agendamento.observacoes,
        local_nome: agendamento.localNome,
        local_endereco: agendamento.localEndereco,
        pode_cancelar: podeSerCancelado(agendamento.status),
        ja_passou: passou,
        codigo_inicio: codigoVisivel ? agendamento.startCode : null,
        avaliado: avaliadosSet.has(agendamento.id),
        clinica_id: agendamento.clinicaId,
        clinica_foto: agendamento.clinica?.fotoPerfil || null,
        exames: agendamento.tipoConsulta === 'exame' ? agendamento.exames : null,
        laudo_disponivel: Boolean(agendamento.laudo),
        veterinario: veterinario
          ? {
              id: veterinario.id,
              nome: veterinario.user!.nome,
              sobrenome: veterinario.user!.sobrenome,
              crmv: veterinario.crmv,
              bio: veterinario.bio,
              fotoUrl: veterinario.fotoUrl,
            }
          : null,
        prestador: prestador
          ? {
              id: prestador.id,
              nome: prestador.user.nome,
              sobrenome: prestador.user.sobrenome,
              fotoUrl: prestador.fotoUrl || prestador.user.profilePic,
              tipo_servico: prestador.tipoServico.nome,
              modalidade: prestador.tipoServico.modalidade,
              servico_id: agendamento.servicoOferecidoId,
              servico: agendamento.servicoOferecido?.nome || null,
              periodo: descreverPeriodo(agendamento),
            }
          : null,
        pet: agendamento.pet
          ? {
              id: agendamento.pet.id,
              nome: agendamento.pet.nome,
              especie: agendamento.pet.especie,
              raca: agendamento.pet.raca,
              porte: agendamento.pet.porte,
              foto_url: agendamento.pet.fotoUrl,
            }
          : null,
        created_at: DateTime.fromJSDate(agendamento.createdAt).toFormat('dd/MM/yyyy HH:mm'),
      }
    })

    return ok({ agendamentos: agendamentosFormatados })
  } catch (error) {
    console.error('Erro ao listar agendamentos:', error)
    return serverError({ message: 'Erro interno do servidor ao listar agendamentos' })
  }
})
