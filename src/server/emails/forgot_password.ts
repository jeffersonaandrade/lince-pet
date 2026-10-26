import 'server-only'
import { e } from './edge'
import { botaoEmail, emailLince } from './layout'

export function forgotPasswordEmail({ url, nome, logoHtml }: { url: string; nome: string; logoHtml?: string }) {
  const link = e(url)
  return emailLince({
    titulo: 'Redefinição de Senha',
    preheader: 'Use este link para criar uma nova senha. Ele expira em 1 hora.',
    logoHtml,
    conteudo: `<h1>Redefinir sua senha</h1>
        <p>Olá, <strong>${e(nome)}</strong></p>
        <p>Recebemos uma solicitação para redefinir a senha da sua conta no Lince Pet. Clique no botão abaixo para escolher uma nova senha.</p>
        ${botaoEmail('Redefinir minha senha', url)}
        <div class="link-card">
          <p>Se o botão não abrir, copie e cole este endereço no navegador:</p>
          <a href="${link}">${link}</a>
        </div>
        <div class="notice">
          <p>Este link expira em 1 hora. Se você não pediu a redefinição, ignore este e-mail: sua senha continua a mesma.</p>
        </div>`,
  })
}
