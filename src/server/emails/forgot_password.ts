import 'server-only'
import { e } from './edge'

const LOGO_STYLE = 'height:90px; width:auto; display:block; margin:0 auto;'

function headerMark(logoHtml?: string) {
  if (logoHtml) return logoHtml
  const url = process.env.EMAIL_LOGO_URL
  if (!url) return `<div style="font-size: 28px; font-weight: bold; color: #ffffff;">🐾 Lince Pet</div>`
  return `<img src="${e(url)}" alt="Lince Pet" style="${LOGO_STYLE}" />`
}

export function forgotPasswordEmail({ url, nome, logoHtml }: { url: string; nome: string; logoHtml?: string }) {
  const link = e(url)
  return `<!DOCTYPE html>
<html lang="pt-BR">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Redefinição de Senha - Lince Pet</title>
    <style>
      body, table, td, a {
        -webkit-text-size-adjust: 100%;
        -ms-text-size-adjust: 100%;
      }
      table, td {
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
        margin: 40px auto;
        background-color: #ffffff;
        border-radius: 16px;
        overflow: hidden;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
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
      .notice {
        background-color: #fff7ed;
        border: 1px solid #fed7aa;
        border-radius: 12px;
        padding: 16px 18px;
        margin: 0 0 28px;
      }
      .notice p {
        margin: 0;
        font-size: 14px;
        color: #9a3412;
      }
      .button-container {
        text-align: center;
        margin: 8px 0 28px;
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
      .link-card {
        background-color: #f3f4f6;
        border-radius: 12px;
        padding: 16px 18px;
        margin: 0 0 24px;
        border: 1px solid #e5e7eb;
      }
      .link-card p {
        margin: 0 0 8px;
        font-size: 13px;
        color: #6b7280;
      }
      .link-card a {
        color: #c2410c;
        font-size: 13px;
        word-break: break-all;
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
    <div style="display: none; max-height: 0; overflow: hidden;">
      Use este link para criar uma nova senha. Ele expira em 1 hora.
    </div>
    <div class="container">
      <div class="header">
        ${headerMark(logoHtml)}
      </div>
      <div class="content">
        <h1>Redefinir sua senha</h1>
        <p>Olá, <strong>${e(nome)}</strong></p>
        <p>Recebemos uma solicitação para redefinir a senha da sua conta no Lince Pet. Clique no botão abaixo para escolher uma nova senha.</p>
        <div class="button-container">
          <a href="${link}" class="button">Redefinir minha senha</a>
        </div>
        <div class="link-card">
          <p>Se o botão não abrir, copie e cole este endereço no navegador:</p>
          <a href="${link}">${link}</a>
        </div>
        <div class="notice">
          <p>Este link expira em 1 hora. Se você não pediu a redefinição, ignore este e-mail: sua senha continua a mesma.</p>
        </div>
      </div>
      <div class="footer">
        <p>© ${new Date().getFullYear()} Lince Pet. Todos os direitos reservados.</p>
        <p>Este é um e-mail automático, por favor não responda.</p>
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
