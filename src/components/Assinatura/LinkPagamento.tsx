import { ExternalLink, ShieldCheck } from 'lucide-react'

/** Abre uma aba da LincePet que prepara o retorno e encaminha à fatura do titular. */
export function LinkPagamento() {
  return <div className="space-y-3 rounded-xl border border-orange-200 bg-orange-50 p-4">
    <div className="flex items-center gap-2 font-semibold text-slate-800"><ShieldCheck size={20} className="shrink-0 text-orange-600" />Pagamento seguro pelo Asaas</div>
    <p className="text-sm text-slate-600">Escolha Pix, boleto ou cartão. O pagamento abre em outra aba e a LincePet continua aberta para você.</p>
    <a href="/pagamento/abrir" target="_blank" rel="noopener noreferrer" className="inline-flex max-w-full items-center justify-center gap-2 rounded-xl bg-[var(--primary)] px-4 py-3 text-center text-sm font-semibold text-white hover:bg-[var(--primary-dark)]">
      Ir para pagamento no Asaas <ExternalLink size={16} className="shrink-0" />
    </a>
    <p className="text-xs text-slate-500">Abre em nova aba. Após pagar, a confirmação do seu plano aparecerá aqui. Boletos dependem da compensação.</p>
  </div>
}
