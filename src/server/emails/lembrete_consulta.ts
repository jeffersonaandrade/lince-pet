import 'server-only'
import { e } from './edge'
import { URL_CONSULTAS_TUTOR } from '@/lib/agenda-tutor'

/** Lembrete da véspera ao tutor (só o de 24h vai por e-mail). Mesmo visual da confirmação de agendamento. */
export type LembreteConsultaEmailData = {
  nomeTutor: string
  pet: string
  profissional: string
  data: string
  hora: string
  local: string
  /** Agendamento de exame: nomes dos exames e preparo. */
  exames?: string | null
  preparo?: string | null
  logoHtml?: string
}

export const assuntoLembrete = (d: Pick<LembreteConsultaEmailData, 'exames'>) =>
  d.exames ? 'Seu exame é amanhã - Lince Pet' : 'Sua consulta é amanhã - Lince Pet'

const LARANJA = '#e67e22'
const linha = (rotulo: string, valor: string) => `
                <tr>
                  <td style="padding:6px 0;width:130px;font-size:13px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px;vertical-align:top;">${e(rotulo)}</td>
                  <td style="padding:6px 0;font-size:16px;color:#333333;">${e(valor)}</td>
                </tr>`

export function lembreteConsultaEmail(d: LembreteConsultaEmailData) {
  const logo =
    d.logoHtml || '<div style="font-size:28px;font-weight:bold;color:#ffffff;">🐾 Lince Pet</div>'
  const titulo = d.exames ? 'Seu exame é amanhã' : 'Sua consulta é amanhã'
  const intro = d.exames
    ? `<strong>${e(d.pet)}</strong> tem exame na <strong>${e(d.profissional)}</strong> amanhã. Confira os detalhes:`
    : `<strong>${e(d.pet)}</strong> tem atendimento com <strong>${e(d.profissional)}</strong> amanhã. Confira os detalhes:`
  const linhas = d.exames
    ? `${linha('Pet', d.pet)}${linha('Exames', d.exames)}${linha('Clínica', d.profissional)}${linha('Data', d.data)}${linha('Horário', d.hora)}${linha('Local', d.local)}${linha('Pagamento', 'Na clínica')}`
    : `${linha('Pet', d.pet)}${linha('Profissional', d.profissional)}${linha('Data', d.data)}${linha('Horário', d.hora)}${linha('Local', d.local)}`
  const preparo = d.preparo
    ? `<div style="background-color:#fffbeb;border:1px solid #fde68a;border-radius:12px;padding:16px 20px;margin-bottom:30px;font-size:15px;line-height:1.6;color:#92400e;"><strong>Preparo:</strong> ${e(d.preparo)}</div>`
    : ''

  return `<!DOCTYPE html>
<html lang="pt-BR">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${titulo} - Lince Pet</title>
  </head>
  <body style="margin:0;padding:0;background-color:#fbfbfb;font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#fbfbfb;">
      <tr>
        <td align="center" style="padding:40px 16px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background-color:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 12px rgba(0,0,0,0.05);">
            <tr>
              <td align="center" style="background-color:${LARANJA};padding:32px 30px;">${logo}</td>
            </tr>
            <tr>
              <td style="padding:40px 40px 30px;color:#333333;">
                <div style="text-align:center;">
                  <span style="display:inline-block;padding:4px 12px;border-radius:20px;font-size:12px;font-weight:600;text-transform:uppercase;background-color:#fef3e9;color:${LARANJA};margin-bottom:15px;">Lembrete</span>
                </div>
                <h1 style="color:#333333;font-size:24px;font-weight:700;margin:0 0 20px;text-align:center;">${titulo}</h1>
                <p style="font-size:16px;line-height:1.6;color:#4b5563;margin:0 0 20px;">Olá, <strong>${e(d.nomeTutor)}</strong>!</p>
                <p style="font-size:16px;line-height:1.6;color:#4b5563;margin:0 0 20px;">${intro}</p>
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f3f4f6;border:1px solid #e5e7eb;border-radius:12px;margin-bottom:30px;">
                  <tr>
                    <td style="padding:18px 24px;">
                      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${linhas}
                      </table>
                    </td>
                  </tr>
                </table>${preparo}
                <div style="text-align:center;">
                  <a href="${URL_CONSULTAS_TUTOR}" style="background-color:${LARANJA};color:#ffffff;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:600;display:inline-block;font-size:16px;">Ver meus agendamentos</a>
                </div>
                <p style="margin:30px 0 0;font-size:14px;line-height:1.6;color:#4b5563;text-align:center;">Precisa remarcar ou cancelar? Faça isso pelo seu painel na Lince Pet.</p>
              </td>
            </tr>
            <tr>
              <td align="center" style="padding:30px;font-size:13px;color:#9ca3af;background-color:#f1f5f9;">
                <p style="margin:0 0 5px;">© ${new Date().getFullYear()} Lince Pet. Todos os direitos reservados.</p>
                <p style="margin:0;">Este é um email automático, por favor não responda.</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`
}
