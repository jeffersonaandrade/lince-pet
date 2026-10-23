import 'server-only'
import type { Prisma } from '@/generated/prisma/client'
import { prisma } from '../db'
import { creating } from '../lucid'
import { enviarPush } from './push'

/** Grava no sino e espelha como notificação do navegador nos aparelhos inscritos do usuário. */
async function create(userId: string, type: string, title: string, message: string, actionData: Prisma.InputJsonObject | null) {
  const notificacao = await prisma.notification.create({
    data: creating({ userId, type, title, message, isRead: 0, actionData: actionData ?? undefined }),
    select: { user: { select: { userType: true } } },
  })
  const tipo = notificacao?.user?.userType
  await enviarPush(userId, { titulo: title, mensagem: message, url: tipo ? `/dashboard/${tipo}` : '/' })
}

const stars = (n: number) => '★'.repeat(n) + '☆'.repeat(5 - n)

type AppointmentParams = {
  veterinarioUserId: string
  tutorNome: string
  dataConsulta: string
  horarioConsulta: string
  agendamentoId: string
}

type TutorAppointmentParams = {
  tutorUserId: string
  veterinarioNome: string
  dataConsulta: string
  horarioConsulta: string
  agendamentoId: string
}

export const inAppNotifications = {
  notifyNewAppointmentToVet: (p: AppointmentParams) =>
    create(p.veterinarioUserId, 'NOVO_AGENDAMENTO', 'Nova consulta agendada!',
      `${p.tutorNome} agendou uma consulta para ${p.dataConsulta} às ${p.horarioConsulta}.`,
      { agendamentoId: p.agendamentoId }),

  notifyAppointmentCancelledToVet: (p: AppointmentParams) =>
    create(p.veterinarioUserId, 'AGENDAMENTO_CANCELADO', 'Consulta cancelada',
      `${p.tutorNome} cancelou a consulta de ${p.dataConsulta} às ${p.horarioConsulta}.`,
      { agendamentoId: p.agendamentoId }),

  notifyAppointmentRescheduledToVet: (p: AppointmentParams) =>
    create(p.veterinarioUserId, 'AGENDAMENTO_REAGENDADO', 'Consulta reagendada',
      `${p.tutorNome} reagendou a consulta para ${p.dataConsulta} às ${p.horarioConsulta}.`,
      { agendamentoId: p.agendamentoId }),

  notifyAppointmentConfirmedToTutor: (p: {
    tutorUserId: string
    veterinarioNome: string
    dataConsulta: string
    horarioConsulta: string
    agendamentoId: string
  }) =>
    create(p.tutorUserId, 'AGENDAMENTO_CONFIRMADO', 'Consulta confirmada!',
      `Dr(a). ${p.veterinarioNome} confirmou sua consulta de ${p.dataConsulta} às ${p.horarioConsulta}.`,
      { agendamentoId: p.agendamentoId }),

  notifyAppointmentScheduledToTutor: (p: TutorAppointmentParams) =>
    create(p.tutorUserId, 'AGENDAMENTO_CONFIRMADO', 'Consulta agendada',
      `Sua consulta com Dr(a). ${p.veterinarioNome} está marcada para ${p.dataConsulta} às ${p.horarioConsulta}.`,
      { agendamentoId: p.agendamentoId }),

  notifyAppointmentRescheduledToTutor: (p: TutorAppointmentParams) =>
    create(p.tutorUserId, 'AGENDAMENTO_REAGENDADO', 'Consulta remarcada',
      `Sua consulta com Dr(a). ${p.veterinarioNome} foi remarcada para ${p.dataConsulta} às ${p.horarioConsulta}.`,
      { agendamentoId: p.agendamentoId }),

  notifyAppointmentReminderToTutor: (p: TutorAppointmentParams & { quando: 'amanha' | 'em_breve'; petNome?: string | null }) =>
    create(p.tutorUserId, 'LEMBRETE_CONSULTA', p.quando === 'amanha' ? 'Sua consulta é amanhã' : 'Sua consulta é daqui a pouco',
      `${p.petNome ? `${p.petNome} tem consulta` : 'Consulta'} com ${p.veterinarioNome} em ${p.dataConsulta} às ${p.horarioConsulta}.`,
      { agendamentoId: p.agendamentoId }),

  notifyAppointmentCancelledByAgendaBlockToTutor: (p: {
    tutorUserId: string
    veterinarioNome: string
    dataConsulta: string
    horarioConsulta: string
    agendamentoId: string
  }) =>
    create(p.tutorUserId, 'AGENDAMENTO_CANCELADO', 'Consulta cancelada',
      `Dr(a). ${p.veterinarioNome} bloqueou a agenda e sua consulta de ${p.dataConsulta} às ${p.horarioConsulta} foi cancelada. Agende um novo horário.`,
      { agendamentoId: p.agendamentoId }),

  notifyAppointmentCompletedToTutor: (p: { tutorUserId: string; veterinarioNome: string; agendamentoId: string }) =>
    create(p.tutorUserId, 'AGENDAMENTO_CONCLUIDO', 'Sua consulta terminou!',
      `O atendimento com Dr(a). ${p.veterinarioNome} foi concluído. O que achou? Deixe sua avaliação!`,
      { agendamentoId: p.agendamentoId, requestReview: true }),

  notifyNewReviewToVet: (p: { veterinarioUserId: string; tutorNome: string; estrelas: number; agendamentoId: string }) =>
    create(p.veterinarioUserId, 'AVALIACAO_RECEBIDA', 'Nova avaliação recebida!',
      `${p.tutorNome} avaliou sua consulta: ${stars(p.estrelas)} (${p.estrelas}/5).`,
      { agendamentoId: p.agendamentoId, estrelas: p.estrelas }),

  notifyNewReviewToClinica: (p: { clinicaUserId: string; tutorNome: string; estrelas: number; agendamentoId: string }) =>
    create(p.clinicaUserId, 'AVALIACAO_RECEBIDA', 'Nova avaliação da clínica!',
      `${p.tutorNome} avaliou sua clínica: ${stars(p.estrelas)} (${p.estrelas}/5).`,
      { agendamentoId: p.agendamentoId, estrelas: p.estrelas }),

  notifyClinicLinkRequest: (p: { veterinarioUserId: string; clinicaNome: string; clinicaId: string }) =>
    create(p.veterinarioUserId, 'VINCULO_CLINICA_SOLICITADO', 'Novo pedido de vínculo!',
      `A clínica ${p.clinicaNome} solicitou vínculo com você. Aceite para começar a atender lá!`,
      { clinicaId: p.clinicaId, clinicaNome: p.clinicaNome, isRequest: true }),

  notifyClinicLinkResponse: (p: { clinicaUserId: string; veterinarioNome: string; aceito: boolean }) =>
    create(p.clinicaUserId, 'RESPOSTA_VINCULO', `Solicitação de vínculo ${p.aceito ? 'aceita' : 'recusada'}`,
      `O veterinário ${p.veterinarioNome} ${p.aceito ? 'aceitou' : 'recusou'} seu pedido de vínculo.`,
      { aceito: p.aceito }),

  createGenericNotification: (p: {
    userId: string
    type: string
    title: string
    message: string
    actionData?: Prisma.InputJsonObject | null
  }) => create(p.userId, p.type, p.title, p.message, p.actionData || null),
}
