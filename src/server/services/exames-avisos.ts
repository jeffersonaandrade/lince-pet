import 'server-only'
import { DateTime } from 'luxon'
import { prisma } from '../db'
import { avisarUsuario, type Aviso } from './aviso-usuario'
import { googleCalendar, type AcaoAgenda } from './google-calendar'

export type EventoExame = 'novo' | 'cancelado_tutor' | 'cancelado_clinica' | 'remarcado' | 'laudo'

const AGENDA: Partial<Record<EventoExame, AcaoAgenda>> = {
  novo: 'criar',
  remarcado: 'atualizar',
  cancelado_tutor: 'cancelar',
  cancelado_clinica: 'cancelar',
}

const carregar = (id: string) =>
  prisma.agendamento.findUnique({
    where: { id },
    include: {
      tutor: { include: { user: true } },
      pet: true,
      clinica: { include: { user: true } },
      exames: true,
      encaminhamentoOrigem: { include: { origemVeterinario: { include: { user: true } } } },
    },
  })

type Agendamento = NonNullable<Awaited<ReturnType<typeof carregar>>>

const quando = (a: Agendamento) =>
  a.inicioEm ? DateTime.fromJSDate(a.inicioEm).setZone('America/Sao_Paulo').toFormat("dd/MM/yyyy 'às' HH:mm") : ''

const nomesDosExames = (a: Agendamento) => a.exames.map((e) => e.nome).join(', ') || 'Exame'

const preparoDe = (a: Agendamento) =>
  a.exames
    .filter((e) => e.preparo)
    .map((e) => `${e.nome}: ${e.preparo}`)
    .join(' | ') || null

const detalhes = (a: Agendamento): [string, string | null][] => [
  ['Exames', nomesDosExames(a)],
  ['Pet', a.pet?.nome ?? null],
  ['Quando', quando(a)],
  ['Local', [a.localNome, a.localEndereco].filter(Boolean).join(' - ') || null],
  ['Valor', `R$ ${Number(a.precoConsulta ?? 0).toFixed(2)} (pagamento na clínica)`],
  ['Preparo', preparoDe(a)],
]

type Para = 'tutor' | 'clinica' | 'vet_origem'

function textos(evento: EventoExame, a: Agendamento, motivo?: string | null): Partial<Record<Para, Aviso>> {
  const pet = a.pet?.nome ?? 'seu pet'
  const clinica = a.clinica?.nomeClinica ?? 'a clínica'
  const tutor = a.tutor?.user ? `${a.tutor.user.nome} ${a.tutor.user.sobrenome ?? ''}`.trim() : 'Tutor'
  const acaoTutor = { agendamentoId: a.id, url: '/dashboard/tutor#consultas' }
  const acaoClinica = { agendamentoId: a.id, url: '/dashboard/clinica/exames' }
  const base = { detalhes: detalhes(a) }
  switch (evento) {
    case 'novo':
      return {
        tutor: { ...base, tipo: 'EXAME_AGENDADO', titulo: 'Exame agendado', mensagem: `Exame de ${pet} confirmado em ${clinica} para ${quando(a)}. O pagamento é feito na clínica.`, actionData: acaoTutor },
        clinica: { ...base, tipo: 'EXAME_NOVO', titulo: 'Novo exame agendado', mensagem: `${tutor} agendou ${nomesDosExames(a)} para ${pet} em ${quando(a)}.`, actionData: acaoClinica },
      }
    case 'remarcado':
      return {
        tutor: { ...base, tipo: 'EXAME_REMARCADO', titulo: 'Exame remarcado', mensagem: `O exame de ${pet} foi remarcado para ${quando(a)}.`, actionData: acaoTutor },
        clinica: { ...base, tipo: 'EXAME_REMARCADO', titulo: 'Exame remarcado', mensagem: `${tutor} remarcou o exame de ${pet} para ${quando(a)}.`, actionData: acaoClinica },
      }
    case 'cancelado_tutor':
      return {
        clinica: { ...base, tipo: 'EXAME_CANCELADO', titulo: 'Exame cancelado', mensagem: `${tutor} cancelou o exame de ${pet} de ${quando(a)}.${motivo ? ` Motivo: ${motivo}` : ''}`, actionData: acaoClinica },
      }
    case 'cancelado_clinica':
      return {
        tutor: { ...base, tipo: 'EXAME_CANCELADO', titulo: 'Exame cancelado pela clínica', mensagem: `${clinica} cancelou o exame de ${pet} de ${quando(a)}. Motivo: ${motivo || 'não informado'}`, actionData: acaoTutor },
      }
    case 'laudo': {
      const laudo = { tipo: 'LAUDO_DISPONIVEL', titulo: 'Laudo disponível', detalhes: detalhes(a).slice(0, 3) }
      const acao = (url: string) => ({ agendamentoId: a.id, petId: a.petId, url })
      return {
        tutor: { ...laudo, mensagem: `O laudo do exame de ${pet} (${nomesDosExames(a)}) está no prontuário.`, actionData: acao('/dashboard/tutor') },
        vet_origem: { ...laudo, mensagem: `Saiu o laudo do exame que você solicitou para ${pet} (${nomesDosExames(a)}). Veja no prontuário.`, actionData: acao('/dashboard/veterinario') },
      }
    }
  }
}

/** Sino, navegador e e-mail do exame + evento do tutor no Google Agenda. Nunca lança. */
export async function avisarExame(evento: EventoExame, id: string, motivo?: string | null) {
  try {
    const a = await carregar(id)
    if (!a) return
    const msgs = textos(evento, a, motivo)
    const destinos: [Para, Parameters<typeof avisarUsuario>[0] | null | undefined][] = [
      ['tutor', a.tutor?.user],
      ['clinica', a.clinica?.user],
      ['vet_origem', a.encaminhamentoOrigem?.origemVeterinario?.user],
    ]
    await Promise.all(destinos.map(([para, user]) => (user && msgs[para] ? avisarUsuario(user, msgs[para]!) : null)))
    const acao = AGENDA[evento]
    if (acao) await googleCalendar.sincronizarEvento(a.id, acao)
  } catch (error) {
    console.error(`❌ [Exames] Falha ao avisar ${evento} (agendamento ${id}):`, error)
  }
}
