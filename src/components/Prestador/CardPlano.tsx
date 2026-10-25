"use client";

import { useCallback, useEffect, useState } from "react";
import { Crown } from "lucide-react";
import { AssinaturasService, type StatusAssinatura } from "@/services/assinaturas/assinaturas";
import { GerenciarAssinatura } from "@/components/Assinatura/GerenciarAssinatura";
import { handleApiError } from "@/utils/errorHandler";
import { Alerta, botaoPrimario } from "./ui";

const PLANO_PAGO = "pro";

export function CardPlano() {
  const [status, setStatus] = useState<StatusAssinatura | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const atualizar = useCallback(async () => { setStatus(await AssinaturasService().obterStatus()); }, []);

  useEffect(() => {
    AssinaturasService()
      .obterStatus()
      .then(setStatus)
      .catch(() => setStatus(null));
  }, []);

  if (!status?.plan) return null;
  const { plan, usage, subscription } = status;
  const gratuito = plan.priceCents === 0;
  const pendente = subscription?.status === "pending" || subscription?.status === "past_due" || status.cancelamentoPendente;

  const assinar = async () => {
    setEnviando(true);
    setErro(null);
    try {
      const servico = AssinaturasService();
      const resposta = subscription
        ? await servico.upgrade(subscription.id, { planCode: PLANO_PAGO })
        : await servico.criarAssinatura({ planCode: PLANO_PAGO });
      if (resposta?.checkoutUrl) window.location.href = resposta.checkoutUrl;
      else setStatus(await servico.obterStatus());
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
      <GerenciarAssinatura status={status} atualizar={atualizar} />
      {usage.limit !== null ? (
        <div className="flex flex-col gap-1.5">
          <span className="text-sm text-slate-600">
            {usage.used} de {usage.limit} aceites neste mês
          </span>
          <div className="h-2 overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-orange-500"
              style={{ width: `${Math.min(100, (usage.used / usage.limit) * 100)}%` }}
            />
          </div>
        </div>
      ) : (
        <span className="text-sm text-slate-600">Aceites sem limite mensal.</span>
      )}
      <p className="text-sm text-slate-500">O aceite conta no mês de Brasília. Cancelar antes do início libera a unidade daquele mês; remarcar exige novo aceite. Pedidos pendentes não consomem o plano.</p>

      {gratuito ? (
        pendente ? (
          !status.cancelamentoPendente ? <Alerta tipo="info">Há uma fatura em aberto. Retome o pagamento pelo link acima para ativar o plano.</Alerta> : null
        ) : (
          <>
            <p className="text-sm text-slate-500">
              No plano Pro você aceita pedidos sem limite mensal. Pague com Pix, boleto ou cartão na fatura do Asaas.
            </p>
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
