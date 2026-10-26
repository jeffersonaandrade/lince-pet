import 'server-only'
import { e } from './edge'
import { botaoEmail, emailLince } from './layout'

/** E-mail dos pedidos de prestador (tosa, passeio, adestramento, hospedagem). Sem termos de consulta. */
export type PedidoServicoEmailData = {
  titulo: string
  saudacao: string
  paragrafos: string[]
  detalhes: [string, string | null | undefined][]
  logoHtml?: string
  /** Código de início, só no e-mail do tutor depois do aceite. */
  codigo?: string | null
  botao?: { rotulo: string; url: string }
}

export function pedidoServicoEmail(d: PedidoServicoEmailData) {
  const detalhes = d.detalhes
    .filter(([, valor]) => valor)
    .map(
      ([rotulo, valor]) =>
        `<div class="detail-item" style="padding: 12px 0; border-bottom: 1px solid #e2e8f0;"><div class="detail-label" style="font-size: 13px; color: #64748b; font-weight: 600; text-transform: uppercase;">${e(rotulo)}</div><div class="detail-value" style="font-size: 16px; color: #1f2937; font-weight: 600; margin-top: 4px;">${e(valor)}</div></div>`
    )
    .join('')

  return emailLince({
    titulo: d.titulo,
    preheader: d.paragrafos[0] || d.titulo,
    logoHtml: d.logoHtml,
    conteudo: `<h1 style="color: #333333; font-size: 24px; font-weight: 700; margin: 0 0 20px; text-align: center;">${e(d.titulo)}</h1>
        <p style="font-size: 16px; line-height: 1.6; color: #4b5563; margin: 0 0 20px;">${e(d.saudacao)}</p>
        ${d.paragrafos.map((p) => `<p style="font-size: 16px; line-height: 1.6; color: #4b5563; margin: 0 0 20px;">${e(p)}</p>`).join('')}
        ${
          detalhes
            ? `<div class="details-card" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 8px 24px; margin: 8px 0 28px;">${detalhes}</div>`
            : ''
        }
        ${
          d.codigo
            ? `<div class="code-section" style="text-align: center; margin: 0 0 28px; padding: 24px; background-color: #fff7ed; border-radius: 12px; border: 1px solid #fed7aa;">
          <div class="code-label" style="font-size: 13px; font-weight: 600; color: #9a3412; text-transform: uppercase; margin-bottom: 12px;">Código de início</div>
          <div class="code-value" style="font-family: 'Courier New', monospace; font-size: 28px; font-weight: 700; color: #e67e22; letter-spacing: 4px; background-color: #ffffff; border: 2px solid #e67e22; border-radius: 8px; padding: 16px; display: inline-block;">${e(d.codigo)}</div>
          <div class="code-hint" style="margin-top: 12px; font-size: 13px; color: #9a3412;">Informe este código ao profissional quando o atendimento começar.</div>
        </div>`
            : ''
        }
        ${d.botao ? botaoEmail(d.botao.rotulo, d.botao.url) : ''}`,
  })
}
