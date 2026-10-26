import 'server-only'
import { e } from './edge'
import { emailLince } from './layout'
import { URL_CONSULTAS_TUTOR } from '@/lib/agenda-tutor'

export type AppointmentConfirmationData = {
  nomeTutor: string
  nomeVeterinario: string
  data: string
  horario: string | null
  tipo: string | null
  localNome?: string | null
  observacoes?: string | null
  verificationCode: string
  logoHtml?: string
}

function detalhe(rotulo: string, valor: string) {
  return `<div class="detail-item">
            <div class="detail-label">${rotulo}</div>
            <div class="detail-value">${e(valor)}</div>
          </div>`
}

export function appointmentConfirmation(d: AppointmentConfirmationData) {
  const local = d.localNome || (d.tipo === 'online' ? 'Teleconsulta (Online)' : 'A combinar')
  return emailLince({
    titulo: 'Confirmação de Agendamento',
    preheader: `Seu agendamento com ${d.nomeVeterinario} está confirmado.`,
    logoHtml: d.logoHtml,
    conteudo: `<h1>Agendamento realizado</h1>
        <p>Olá, <strong>${e(d.nomeTutor)}</strong></p>
        <p>Tudo pronto! Seu agendamento com <strong>${e(d.nomeVeterinario)}</strong> foi realizado com sucesso.</p>
        <div class="details-card">
          ${detalhe('Data', d.data)}
          ${detalhe('Horário', d.horario || '')}
          ${detalhe('Local', local)}
          ${d.observacoes ? detalhe('Observações', d.observacoes) : ''}
        </div>
        <p>Para garantir a segurança do seu atendimento, use o código abaixo no momento da consulta:</p>
        <div class="code-section">
          <div class="code-label">Código de início</div>
          <div class="code-value">${e(d.verificationCode)}</div>
          <div class="code-hint">Informe este código ao veterinário quando começar o atendimento.</div>
        </div>
        <div class="button-container">
          <a href="${URL_CONSULTAS_TUTOR}" class="button">Ver meus agendamentos</a>
        </div>
        <div class="notice">
          <p>Precisa reagendar ou cancelar? Você pode fazer isso pelo painel em até 24h antes do horário marcado.</p>
        </div>`,
  })
}
