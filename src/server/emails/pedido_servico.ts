import 'server-only'
import { e } from './edge'

/** E-mail genérico dos pedidos de prestador (tosa, passeio, adestramento, hospedagem). Sem termos de consulta. */
export type PedidoServicoEmailData = {
  titulo: string
  saudacao: string
  paragrafos: string[]
  detalhes: [string, string | null | undefined][]
  logoHtml?: string
}

export function pedidoServicoEmail(d: PedidoServicoEmailData) {
  const detalhes = d.detalhes
    .filter(([, valor]) => valor)
    .map(
      ([rotulo, valor]) =>
        `<tr><td style="padding:6px 0;color:#6b7280;width:40%;">${e(rotulo)}</td><td style="padding:6px 0;color:#111827;font-weight:600;">${e(valor)}</td></tr>`
    )
    .join('')

  return `<!DOCTYPE html>
<html lang="pt-BR">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${e(d.titulo)} - Lince Pet</title>
  </head>
  <body style="margin:0;padding:0;background-color:#fbfbfb;font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td align="center" style="padding:32px 16px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:16px;padding:32px;">
            <tr><td align="center" style="padding-bottom:16px;">${d.logoHtml || ''}</td></tr>
            <tr><td style="font-size:22px;font-weight:700;color:#111827;padding-bottom:12px;">${e(d.titulo)}</td></tr>
            <tr><td style="font-size:15px;color:#374151;padding-bottom:12px;">${e(d.saudacao)}</td></tr>
            ${d.paragrafos.map((p) => `<tr><td style="font-size:15px;color:#374151;padding-bottom:12px;">${e(p)}</td></tr>`).join('')}
            <tr>
              <td style="padding-top:8px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:14px;border-top:1px solid #e5e7eb;">
                  ${detalhes}
                </table>
              </td>
            </tr>
            <tr><td style="font-size:12px;color:#9ca3af;padding-top:24px;" align="center">© ${new Date().getFullYear()} Lince Pet. Todos os direitos reservados.</td></tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`
}
