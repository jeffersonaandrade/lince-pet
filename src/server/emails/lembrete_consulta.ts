import 'server-only'
import { pedidoServicoEmail } from './pedido_servico'

/** Lembrete da véspera ao tutor (só o de 24h vai por e-mail). */
export type LembreteConsultaEmailData = {
  nomeTutor: string
  pet: string
  profissional: string
  data: string
  hora: string
  local: string
  logoHtml?: string
}

export function lembreteConsultaEmail(d: LembreteConsultaEmailData) {
  return pedidoServicoEmail({
    titulo: 'Sua consulta é amanhã',
    saudacao: `Olá, ${d.nomeTutor}!`,
    paragrafos: [`Lembrete: ${d.pet} tem atendimento com ${d.profissional} amanhã, ${d.data}, às ${d.hora}.`],
    detalhes: [
      ['Pet', d.pet],
      ['Profissional', d.profissional],
      ['Data', d.data],
      ['Horário', d.hora],
      ['Local', d.local],
    ],
    logoHtml: d.logoHtml,
  })
}
