import 'server-only'

export type EventoWhatsapp =
  | 'confirmacao'
  | 'novo_agendamento'
  | 'lembrete_24h'
  | 'lembrete_2h'
  | 'cancelamento'
  | 'remarcacao'

export type Destinatario = 'tutor' | 'profissional'

export type DadosMensagem = {
  tutor: string
  pet: string
  profissional: string
  data: string
  hora: string
  local: string
  motivo?: string | null
}

const rodape = '\n\n_Lince Pet: avisos automáticos de consultas. Para não receber, desative no seu perfil._'

const detalhes = (d: DadosMensagem) =>
  `🐾 Pet: ${d.pet}\n📅 Data: ${d.data}\n🕐 Hora: ${d.hora}\n📍 Local: ${d.local}`

/** Texto de cada evento por destinatário; null = evento não se aplica a esse destinatário. */
export function montarMensagem(evento: EventoWhatsapp, para: Destinatario, d: DadosMensagem): string | null {
  const motivo = d.motivo ? `\nMotivo: ${d.motivo}` : ''

  if (para === 'tutor') {
    switch (evento) {
      case 'confirmacao':
        return `Olá, ${d.tutor}! Sua consulta com ${d.profissional} está agendada.\n\n${detalhes(d)}${rodape}`
      case 'lembrete_24h':
        return `Olá, ${d.tutor}! Lembrete: a consulta de ${d.pet} com ${d.profissional} é amanhã.\n\n${detalhes(d)}${rodape}`
      case 'lembrete_2h':
        return `Olá, ${d.tutor}! A consulta de ${d.pet} com ${d.profissional} começa em cerca de 2 horas.\n\n${detalhes(d)}${rodape}`
      case 'cancelamento':
        return `Olá, ${d.tutor}. A consulta de ${d.pet} com ${d.profissional} em ${d.data} às ${d.hora} foi cancelada pelo profissional.${motivo}\n\nVocê pode reagendar pela Lince Pet.${rodape}`
      case 'remarcacao':
        return `Olá, ${d.tutor}! Sua consulta com ${d.profissional} foi remarcada.\n\n${detalhes(d)}${rodape}`
      default:
        return null
    }
  }

  switch (evento) {
    case 'novo_agendamento':
      return `Olá, ${d.profissional}! Nova consulta agendada por ${d.tutor}.\n\n${detalhes(d)}`
    case 'cancelamento':
      return `Olá, ${d.profissional}. ${d.tutor} cancelou a consulta de ${d.pet} em ${d.data} às ${d.hora}.${motivo}`
    case 'remarcacao':
      return `Olá, ${d.profissional}! ${d.tutor} remarcou a consulta de ${d.pet}.\n\n${detalhes(d)}`
    default:
      return null
  }
}
