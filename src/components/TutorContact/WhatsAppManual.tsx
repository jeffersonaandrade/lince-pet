import { MessageCircle } from 'lucide-react'
import { linkWhatsAppManual, type AvisoWhatsApp } from '@/lib/whatsapp-manual'

export default function WhatsAppManual({ telefone, aviso, permitido = true }: {
  telefone?: string | null
  aviso: AvisoWhatsApp
  permitido?: boolean
}) {
  const link = permitido ? linkWhatsAppManual(telefone, aviso) : null
  return (
    <div className="min-w-0 space-y-2">
      {link ? (
        <a href={link} target="_blank" rel="noopener noreferrer" className="inline-flex max-w-full items-center justify-center gap-2 rounded-xl bg-orange-500 px-4 py-2 text-sm font-semibold text-white no-underline transition-colors hover:bg-orange-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-600">
          <MessageCircle size={16} className="shrink-0" />
          Avisar tutor pelo WhatsApp
        </a>
      ) : (
        <p className="text-xs text-slate-500">{permitido ? 'WhatsApp indisponível: tutor sem telefone válido cadastrado.' : 'O tutor desativou os avisos por WhatsApp.'}</p>
      )}
      {link ? <p className="text-xs text-slate-500">Envio manual pela conta conectada ao WhatsApp neste dispositivo. Confira a conta e a mensagem antes de enviar. Abrir a conversa não confirma o envio.</p> : null}
    </div>
  )
}
