import 'server-only'
import { e } from './edge'

export type AppointmentRescheduledVetData = {
  nomeVeterinario: string
  nomeTutor: string
  data: string
  horario: string | null
  tipo: string | null
  localNome?: string | null
  logoHtml?: string
}

export function appointmentRescheduledVet(d: AppointmentRescheduledVetData) {
  return `<!DOCTYPE html>
<html lang="pt-BR">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>
      Aviso de Reagendamento - Lince Pet
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
      
      .status-badge {
        display: inline-block;
        padding: 4px 12px;
        border-radius: 20px;
        font-size: 12px;
        font-weight: 600;
        text-transform: uppercase;
        background-color: #fef3e9;
        color: #e67e22;
        margin-bottom: 15px;
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
          <span class="status-badge">Reagendamento</span>
        </div>
        <h1>
          Atenção: Consulta Reagendada!
        </h1>
        <p>
          Olá <strong>${e(d.nomeVeterinario)}</strong>,
        </p>
        <p>
          Informamos que uma consulta foi reagendada pelo tutor. Confira os novos detalhes:
        </p>

        <div class="details-card">
          <div class="detail-item">
            <div class="detail-label">
              Tutor:
            </div>
            <div class="detail-value">
              ${e(d.nomeTutor)}
            </div>
          </div>

          <div class="detail-item" style="margin-top: 10px;">
            <div class="detail-label">
              Nova Data:
            </div>
            <div class="detail-value" style="color: #e67e22; font-weight: 700;">
              ${e(d.data)} às ${e(d.horario)}
            </div>
          </div>

          <div class="detail-item">
            <div class="detail-label">
              Local:
            </div>
            <div class="detail-value">
              ${e(d.localNome || (d.tipo === 'online' ? 'Teleconsulta (Online)' : 'A combinar'))}
            </div>
          </div>
        </div>

        <div class="button-container">
          <a href="https://www.lincepet.com.br" class="button">Acessar Meu Painel</a>
        </div>

        <p style="margin-top: 30px; font-size: 14px; text-align: center;">
          Este reagendamento já foi atualizado em seu calendário. Caso tenha alguma dúvida, entre em contato com o suporte.
        </p>
      </div>

      <div class="footer">
        <p>
          © 2025 Lince Pet. Todos os direitos reservados.
        </p>
        <p>
          Este é um email automático, por favor não responda.
        </p>
      </div>
    </div>
  </body>
</html>
`
}
