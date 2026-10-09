import 'server-only'
import { e } from './edge'

export type AppointmentCancellationData = {
  nomeTutor: string
  nomeVeterinario: string
  data: string
  horario: string | null
  motivo?: string | null
  isVeterinario?: boolean
  logoHtml?: string
}

export function appointmentCancellation(d: AppointmentCancellationData) {
  return `<!DOCTYPE html>
<html lang="pt-BR">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>
      Cancelamento de Agendamento - Lince Pet
    </title>
    <style>
      body,
      table,
      td,
      a {
        -webkit-text-size-adjust: 100%;
        -ms-text-size-adjust: 100%;
      }
      
      table,
      td {
        mso-table-lspace: 0pt;
        mso-table-rspace: 0pt;
      }
      
      img {
        -ms-interpolation-mode: bicubic;
        border: 0;
        height: auto;
        line-height: 100%;
        outline: none;
        text-decoration: none;
      }
      
      table {
        border-collapse: collapse !important;
      }
      
      body {
        height: 100% !important;
        margin: 0 !important;
        padding: 0 !important;
        width: 100% !important;
        background-color: #fbfbfb;
        font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      }
      
      .container {
        max-width: 600px;
        margin: 0 auto;
        background-color: #ffffff;
        border-radius: 16px;
        overflow: hidden;
        margin-top: 40px;
        margin-bottom: 40px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.05);
      }
      
      .header {
        background-color: #e67e22;
        padding: 32px 30px;
        text-align: center;
      }
      
      .content {
        padding: 40px 40px 30px;
        color: #333333;
      }
      
      h1 {
        color: #333333;
        font-size: 24px;
        font-weight: 700;
        margin: 0 0 20px;
        text-align: center;
      }
      
      p {
        font-size: 16px;
        line-height: 1.6;
        color: #4b5563;
        margin: 0 0 20px;
      }
      
      .details-card {
        background-color: #f3f4f6;
        border-radius: 12px;
        padding: 24px;
        margin-bottom: 30px;
        border: 1px solid #e5e7eb;
      }
      
      .detail-item {
        margin-bottom: 12px;
        display: table;
        width: 100%;
      }
      
      .detail-label {
        font-weight: 700;
        color: #6b7280;
        width: 140px;
        display: table-cell;
        font-size: 14px;
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }
      
      .detail-value {
        color: #333333;
        display: table-cell;
        font-size: 16px;
      }
      
      .status-badge {
        display: inline-block;
        padding: 4px 12px;
        border-radius: 20px;
        font-size: 12px;
        font-weight: 600;
        text-transform: uppercase;
        background-color: #fee2e2;
        color: #991b1b;
        margin-bottom: 15px;
      }
      
      .button-container {
        text-align: center;
        margin-top: 30px;
      }
      
      .button {
        background-color: #e67e22;
        color: #ffffff !important;
        padding: 14px 28px;
        border-radius: 8px;
        text-decoration: none;
        font-weight: 600;
        display: inline-block;
        font-size: 16px;
      }
      
      .footer {
        text-align: center;
        padding: 30px;
        font-size: 13px;
        color: #9ca3af;
        background-color: #f1f5f9;
      }
      
      .footer p {
        margin-bottom: 5px;
        font-size: 13px;
        color: #9ca3af;
      }
      
      .footer-links {
        margin-top: 15px;
      }
      
      .footer-links a {
        color: #e67e22;
        text-decoration: none;
        margin: 0 10px;
      }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="header">
${
  d.logoHtml
    ? `          ${d.logoHtml}`
    : `          <div style="font-size: 28px; font-weight: bold; color: #ffffff;">
            🐾 Lince Pet
          </div>`
}
      </div>

      <div class="content">
        <div style="text-align: center;">
          <span class="status-badge">Cancelado</span>
        </div>
        <h1>
          Agendamento Cancelado
        </h1>
        <p>
          Olá <strong>${e(d.isVeterinario ? d.nomeVeterinario : d.nomeTutor)}</strong>,
        </p>
        <p>
${
  d.isVeterinario
    ? `            Informamos que o seu agendamento com <strong>${e(d.nomeTutor)}</strong> foi cancelado.`
    : `            Confirmamos o cancelamento do seu agendamento com o <strong>${e(d.nomeVeterinario)}</strong>.`
}
        </p>

        <div class="details-card">
          <div class="detail-item">
            <div class="detail-label">
              Data:
            </div>
            <div class="detail-value">
              ${e(d.data)}
            </div>
          </div>
          <div class="detail-item">
            <div class="detail-label">
              Horário:
            </div>
            <div class="detail-value">
              ${e(d.horario)}
            </div>
          </div>
          <div class="detail-item">
            <div class="detail-label">
              Motivo:
            </div>
            <div class="detail-value">
              ${e(d.motivo || 'Solicitado pelo tutor')}
            </div>
          </div>
        </div>

${
  !d.isVeterinario
    ? `          <p>
            Se você cancelou por engano ou deseja marcar uma nova consulta, clique no botão abaixo para encontrar outros horários disponíveis.
          </p>

          <div class="button-container">
            <a href="https://www.lincepet.com.br/explorar" class="button">Ver Veterinários Disponíveis</a>
          </div>`
    : `          <div class="button-container">
            <a href="https://www.lincepet.com.br" class="button">Acessar Minha Conta</a>
          </div>`
}

        <p style="margin-top: 30px; font-size: 14px; text-align: center;">
${
  d.isVeterinario
    ? `            Seus créditos foram devolvidos para sua conta.`
    : `            Sentimos muito que você tenha tido que cancelar. Esperamos ver você e seu pet em breve!`
}
        </p>
      </div>

      <div class="footer">
        <p>
          © ${new Date().getFullYear()} Lince Pet. Todos os direitos reservados.
        </p>
        <p>
          Este é um email automático, por favor não responda.
        </p>
        <div class="footer-links">
          <a href="https://www.lincepet.com.br/">Nosso Site</a>
          <a href="https://www.lincepet.com.br/suporte">Suporte</a>
          <a href="https://www.instagram.com/lincepet">Instagram</a>
        </div>
      </div>
    </div>
  </body>
</html>
`
}
