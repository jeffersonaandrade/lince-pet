import { toWhatsAppLink } from '@/utils/formatters'

export interface AvisoWhatsApp {
  nome?: string | null
  data?: string | null
  horario?: string | null
  status?: string | null
  local?: string | null
  laudoDisponivel?: boolean
}

// Apenas dados operacionais. Nunca incluir prontuário, diagnóstico, códigos ou links de laudo.
const texto = (valor?: string | null) => (valor || '').replace(/https?:\/\/\S+|www\.\S+/gi, '[link removido]').replace(/[\r\n\t]+/g, ' ').trim().slice(0, 180)

export function mensagemWhatsAppManual(aviso: AvisoWhatsApp): string {
  const status = texto(aviso.status)
  // O status interno da reserva não representa uma etapa de aceite do profissional.
  const exibirStatus = status && !['pendente', 'aguardando'].includes(status.toLowerCase())
  const situacao: Record<string, string> = {
    confirmado: 'Confirmado',
    cancelado: 'Cancelado', realizado: 'Realizado', concluido: 'Concluído', concluida: 'Concluído', 'em andamento': 'Em andamento',
  }
  return [
    `Olá${texto(aviso.nome) ? `, ${texto(aviso.nome)}` : ''}! Aqui é a equipe responsável pelo seu atendimento na LincePet.`,
    'Informações do agendamento:',
    aviso.data ? `Data: ${texto(aviso.data)}${aviso.horario ? ` às ${texto(aviso.horario)}` : ''}.` : null,
    aviso.local ? `Local: ${texto(aviso.local)}.` : null,
    exibirStatus ? `Situação: ${situacao[status.toLowerCase()] || status}.` : null,
    aviso.laudoDisponivel ? 'O resultado está disponível para consulta no site.' : null,
    'Confira os detalhes acessando sua conta: https://lincepet.com.br/dashboard/tutor',
  ].filter(Boolean).join('\n')
}

export function linkWhatsAppManual(telefone: string | null | undefined, aviso: AvisoWhatsApp): string | null {
  const link = toWhatsAppLink(telefone)
  return link ? `${link}?text=${encodeURIComponent(mensagemWhatsAppManual(aviso))}` : null
}
