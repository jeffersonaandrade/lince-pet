import 'server-only'
import { escapeHtml } from '../services/mail'

export function forgotPasswordEmail({ url, nome }: { url: string; nome: string }) {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Redefinição de Senha - Lince-Pet</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
  <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
    <h2 style="color: #6366f1;">Olá, ${escapeHtml(nome)}</h2>
    <p>Recebemos uma solicitação para redefinir a senha da sua conta no Lince-Pet.</p>
    <p>Se você não fez essa solicitação, pode ignorar este e-mail.</p>
    
    <p>Para redefinir sua senha, clique no botão abaixo:</p>
    <div style="text-align: center; margin: 30px 0;">
      <a href="${escapeHtml(url)}" 
         style="background-color: #6366f1; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: bold;">
        Redefinir Minha Senha
      </a>
    </div>
    
    <p>Ou copie e cole o link abaixo no seu navegador:</p>
    <p style="word-break: break-all; color: #666; font-size: 14px;">${escapeHtml(url)}</p>
    
    <p style="margin-top: 40px; font-size: 12px; color: #999;">
      Este link expirará em 1 hora.<br>
      Equipe Lince-Pet
    </p>
  </div>
</body>
</html>
`
}
