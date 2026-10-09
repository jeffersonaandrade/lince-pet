import type { StatusAssinatura, StatusLabel } from "@/services/assinaturas/assinaturas";

const SELO: Record<StatusLabel, { texto: string; classe: string }> = {
  ativa: { texto: "Ativa", classe: "bg-emerald-100 text-emerald-800" },
  pendente: { texto: "Pagamento pendente", classe: "bg-amber-100 text-amber-800" },
  inadimplente: { texto: "Inadimplente", classe: "bg-red-100 text-red-800" },
  cancelada: { texto: "Cancelada", classe: "bg-slate-200 text-slate-700" },
};

/** Selo do status da assinatura (reflexo do Asaas) e atalho para pagar a fatura em aberto. */
export function StatusAssinaturaAviso({ status }: { status: StatusAssinatura }) {
  if (!status.statusLabel) return null;
  const selo = SELO[status.statusLabel];
  const fimTeste = status.emTeste && status.trialEnd ? new Date(status.trialEnd).toLocaleDateString("pt-BR") : null;

  return (
    <div className="mb-6 flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 text-left sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-slate-600">Assinatura</span>
          <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${selo.classe}`}>{selo.texto}</span>
        </div>
        {fimTeste ? (
          <p className="text-sm text-slate-600">Teste grátis até {fimTeste}. A 1a fatura vence nessa data.</p>
        ) : null}
        {status.statusLabel === "inadimplente" ? (
          <p className="text-sm text-red-700">A fatura venceu e os recursos do plano foram suspensos. Pague para reativar.</p>
        ) : null}
        {status.pendingPlanId ? (
          <p className="text-sm text-amber-700">Há uma troca de plano aguardando pagamento.</p>
        ) : null}
      </div>
      {status.checkoutUrl ? (
        <a
          href={status.checkoutUrl}
          className="inline-flex items-center justify-center rounded-lg bg-orange-500 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-600"
        >
          Pagar fatura pendente
        </a>
      ) : null}
    </div>
  );
}
