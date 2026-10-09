"use client";

import { useEffect, useState } from "react";
import { Crown } from "lucide-react";
import { AssinaturasService } from "@/services/assinaturas/assinaturas";
import { handleApiError } from "@/utils/errorHandler";
import { Alerta, botaoPrimario } from "./ui";

type Status = {
  plan: { code: string; name: string; priceCents: number } | null;
  usage: { used: number; limit: number | null };
  subscription: { id: string; status: string; asaasSubscriptionId: string | null } | null;
};

const PLANO_PAGO = "pro";

export function CardPlano() {
  const [status, setStatus] = useState<Status | null>(null);
  const [pagamento, setPagamento] = useState<"CREDIT_CARD" | "PIX">("CREDIT_CARD");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    AssinaturasService()
      .obterStatus()
      .then(setStatus)
      .catch(() => setStatus(null));
  }, []);

  if (!status?.plan) return null;
  const { plan, usage, subscription } = status;
  const gratuito = plan.priceCents === 0;
  const pendente = subscription?.status === "pending";

  const assinar = async () => {
    setEnviando(true);
    setErro(null);
    try {
      const servico = AssinaturasService();
      const resposta = subscription?.asaasSubscriptionId
        ? await servico.upgrade(subscription.id, { planCode: PLANO_PAGO, billingType: pagamento })
        : await servico.criarAssinatura({ planCode: PLANO_PAGO, billingType: pagamento });
      if (resposta?.checkoutUrl) window.location.href = resposta.checkoutUrl;
    } catch (e) {
      setErro(handleApiError(e).message);
    } finally {
      setEnviando(false);
    }
  };

  return (
    <section className="flex flex-col gap-3 rounded-3xl bg-white p-6 shadow-sm">
      <div className="flex items-center gap-2">
        <Crown size={18} className="text-orange-500" />
        <h2 className="text-lg font-bold text-slate-800">Plano {plan.name}</h2>
      </div>
      {usage.limit !== null ? (
        <div className="flex flex-col gap-1.5">
          <span className="text-sm text-slate-600">
            {usage.used} de {usage.limit} pedidos neste mês
          </span>
          <div className="h-2 overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-orange-500"
              style={{ width: `${Math.min(100, (usage.used / usage.limit) * 100)}%` }}
            />
          </div>
        </div>
      ) : (
        <span className="text-sm text-slate-600">Pedidos ilimitados.</span>
      )}

      {gratuito ? (
        pendente ? (
          <Alerta tipo="info">Pagamento em processamento. O plano muda assim que for confirmado.</Alerta>
        ) : (
          <>
            <p className="text-sm text-slate-500">No plano Pro você recebe pedidos sem limite mensal.</p>
            <div className="flex gap-2">
              {(["CREDIT_CARD", "PIX"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setPagamento(t)}
                  className={`flex-1 rounded-xl border px-3 py-2 text-sm font-semibold ${
                    pagamento === t ? "border-orange-500 bg-orange-50 text-orange-700" : "border-slate-200 text-slate-600"
                  }`}
                >
                  {t === "PIX" ? "PIX" : "Cartão"}
                </button>
              ))}
            </div>
            <button className={botaoPrimario} disabled={enviando} onClick={assinar}>
              {enviando ? "Abrindo pagamento..." : "Assinar Pro"}
            </button>
          </>
        )
      ) : null}
      {erro ? <Alerta>{erro}</Alerta> : null}
    </section>
  );
}
