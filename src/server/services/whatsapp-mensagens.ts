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
  /** Pedido de prestador: nome do serviço ("Banho completo"). Ausente = consulta veterinária. */
  servico?: string | null
  /** Agendamento de exame: nomes dos exames e o preparo (só os lembretes saem por aqui). */
  exames?: string | null
  preparo?: string | null
}

const rodape = '\n\n_Lince Pet: avisos automáticos de consultas. Para não receber, desative no seu perfil._'
const rodapeServico = '\n\n_Lince Pet: avisos automáticos de pedidos. Para não receber, desative no seu perfil._'

const detalhes = (d: DadosMensagem) =>
  `🐾 Pet: ${d.pet}\n📅 Data: ${d.data}\n🕐 Hora: ${d.hora}\n📍 Local: ${d.local}`

function mensagemServico(evento: EventoWhatsapp, para: Destinatario, d: DadosMensagem): string | null {
  const motivo = d.motivo ? `\nMotivo: ${d.motivo}` : ''
  const servico = `"${d.servico}"`
  const info = `🛎️ Serviço: ${d.servico}\n${detalhes(d)}`

  if (para === 'tutor') {
    switch (evento) {
      case 'confirmacao':
        return `Olá, ${d.tutor}! ${d.profissional} aceitou o pedido ${servico} para ${d.pet}.\n\n${info}${rodapeServico}`
      case 'lembrete_24h':
        return `Olá, ${d.tutor}! Lembrete: o serviço ${servico} de ${d.pet} com ${d.profissional} é amanhã.\n\n${info}${rodapeServico}`
      case 'lembrete_2h':
        return `Olá, ${d.tutor}! O serviço ${servico} de ${d.pet} com ${d.profissional} começa em cerca de 2 horas.\n\n${info}${rodapeServico}`
      case 'cancelamento':
        return `Olá, ${d.tutor}. O pedido ${servico} de ${d.pet} com ${d.profissional} em ${d.data} às ${d.hora} foi cancelado pelo profissional.${motivo}${rodapeServico}`
      case 'remarcacao':
        return `Olá, ${d.tutor}! O pedido ${servico} com ${d.profissional} foi remarcado.\n\n${info}${rodapeServico}`
      default:
        return null
    }
  }

  switch (evento) {
    case 'novo_agendamento':
      return `Olá, ${d.profissional}! Novo pedido de ${d.tutor}: ${servico}. Aceite ou recuse pela Lince Pet.\n\n${info}`
    case 'cancelamento':
      return `Olá, ${d.profissional}. ${d.tutor} cancelou o pedido ${servico} de ${d.pet} em ${d.data} às ${d.hora}.${motivo}`
    case 'remarcacao':
      return `Olá, ${d.profissional}! ${d.tutor} remarcou o pedido ${servico} de ${d.pet}.\n\n${info}`
    default:
      return null
  }
}

function mensagemExame(evento: EventoWhatsapp, para: Destinatario, d: DadosMensagem): string | null {
  if (para !== 'tutor') return null
  const info = `🔬 Exames: ${d.exames}\n${detalhes(d)}${d.preparo ? `\n⚠️ Preparo: ${d.preparo}` : ''}\n💳 Pagamento na clínica`
  switch (evento) {
    case 'lembrete_24h':
      return `Olá, ${d.tutor}! Lembrete: o exame de ${d.pet} na ${d.profissional} é amanhã.\n\n${info}${rodape}`
    case 'lembrete_2h':
      return `Olá, ${d.tutor}! O exame de ${d.pet} na ${d.profissional} começa em cerca de 2 horas.\n\n${info}${rodape}`
    default:
      return null
  }
}

const LINK = /https?:\/\/\S+|www\.\S+|\b[\w-]+(?:\.[\w-]+)*\.(?:com|net|org|br|io|xyz|app|me|link|info|site|online|shop|top|ly)\b\S*/gi

/** Campo digitado por usuário (nome, pet, motivo): sem links e com tamanho limitado, pois sai do número oficial. */
export const textoSeguro = (valor: string, max = 80) =>
  valor.replace(LINK, '[link removido]').replace(/\s+/g, ' ').trim().slice(0, max)

function dadosSeguros(d: DadosMensagem): DadosMensagem {
  return {
    ...d,
    tutor: textoSeguro(d.tutor),
    pet: textoSeguro(d.pet),
    profissional: textoSeguro(d.profissional),
    local: textoSeguro(d.local, 200),
    motivo: d.motivo ? textoSeguro(d.motivo, 200) : d.motivo,
    servico: d.servico ? textoSeguro(d.servico) : d.servico,
    exames: d.exames ? textoSeguro(d.exames, 200) : d.exames,
    preparo: d.preparo ? textoSeguro(d.preparo, 300) : d.preparo,
  }
}

/** Texto de cada evento por destinatário; null = evento não se aplica a esse destinatário. */
export function montarMensagem(evento: EventoWhatsapp, para: Destinatario, dados: DadosMensagem): string | null {
  const d = dadosSeguros(dados)
  if (d.exames) return mensagemExame(evento, para, d)
  if (d.servico) return mensagemServico(evento, para, d)
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
