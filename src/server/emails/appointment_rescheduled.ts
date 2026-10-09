import 'server-only'
import { e } from './edge'

export type AppointmentRescheduledData = {
  nomeTutor: string
  nomeVeterinario: string
  data: string
  horario: string | null
  tipo: string | null
  localNome?: string | null
  verificationCode: string
  logoHtml?: string
}

export function appointmentRescheduled(d: AppointmentRescheduledData) {
  return `<!DOCTYPE html>
<html lang="pt-BR">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>
      Reagendamento de Consulta - Lince Pet
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
      
      .new-value {
        color: #e67e22;
        font-weight: 700;
        font-size: 18px;
        display: block;
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
          <span class="status-badge">Reagendado</span>
        </div>
        <h1>
          Consulta Reagendada!
        </h1>
        <p>
          Olá <strong>${e(d.nomeTutor)}</strong>,
        </p>
        <p>
          Seu agendamento com o <strong>${e(d.nomeVeterinario)}</strong>foi reagendado com sucesso. Verifique as novas informações abaixo:
        </p>

        <div class="details-card">
          <div class="detail-item" style="margin-bottom: 20px;">
            <div class="detail-label">
              Nova Data e Hora:
            </div>
            <div class="detail-value">
              <span class="new-value">${e(d.data)} às ${e(d.horario)}</span>
            </div>
          </div>

          <div class="detail-item">
            <div class="detail-label">
              Veterinário:
            </div>
            <div class="detail-value">
              ${e(d.nomeVeterinario)}
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

        <p>
          Seu código de início continua o mesmo e deve ser usado no momento da consulta:
        </p>

        <div style="text-align: center; margin: 30px 0;">
          <div style="font-size: 14px; color: #6b7280; margin-bottom: 10px;">
            Código de Início:
          </div>
          <div
            style="background-color: #ffffff; border: 2px solid #e67e22; border-radius: 8px; padding: 16px; display: inline-block; min-width: 150px;"
          >
            <div
              style="font-family: 'Monaco', 'Courier New', monospace; font-size: 28px; font-weight: 700; color: #e67e22; letter-spacing: 4px;"
            >
              ${e(d.verificationCode)}
            </div>
          </div>
        </div>

        <div class="button-container">
          <a href="https://www.lincepet.com.br/meus-agendamentos" class="button">Ver Meus Agendamentos</a>
        </div>

        <p style="margin-top: 30px; font-size: 14px; text-align: center;">
          Tudo certo! Agora é só aguardar o dia da consulta. Caso precise de qualquer ajuda, entre em contato conosco.
        </p>
      </div>

      <div class="footer">
        <p>
          © 2025 Lince Pet. Todos os direitos reservados.
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
