"use client";

import { useCallback, useEffect, useState } from "react";
import { ResumoContratacao, precoMensal } from "@/components/Assinatura/ResumoContratacao";
import { Crown } from "lucide-react";
import { AssinaturasService, type StatusAssinatura, type PlanoBackend } from "@/services/assinaturas/assinaturas";
import { GerenciarAssinatura } from "@/components/Assinatura/GerenciarAssinatura";
import { handleApiError } from "@/utils/errorHandler";
import { Alerta, botaoPrimario } from "./ui";

const PLANO_PAGO = "pro";

export function CardPlano({ revisao }: { revisao?: unknown }) {
  const [status, setStatus] = useState<StatusAssinatura | null>(null);
  const [oferta, setOferta] = useState<PlanoBackend | null>(null);
  const [confirmando, setConfirmando] = useState(false);
  const [aceito, setAceito] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const atualizar = useCallback(async () => { setStatus(await AssinaturasService().obterStatus({ incluirFatura: false })); }, []);

  useEffect(() => {
    AssinaturasService().listarPlanos("prestador").then(planos => setOferta(planos.find(p => p.code === PLANO_PAGO) ?? null)).catch(() => setOferta(null));
    AssinaturasService()
      .obterStatus()
      .then(setStatus)
      .catch(() => setStatus(null));
  }, [revisao]);

  if (!status?.plan) return null;
  const { plan, usage, subscription } = status;
  const gratuito = plan.priceCents === 0;
  const pendente = subscription?.status === "pending" || subscription?.status === "past_due" || status.cancelamentoPendente;

  const assinar = async () => {
    if (!oferta || !aceito || !confirmando) return;
    setEnviando(true);
    setErro(null);
    try {
      const servico = AssinaturasService();
      const resposta = subscription
        ? await servico.upgrade(subscription.id, { planCode: PLANO_PAGO, valorConfirmadoCentavos: oferta.priceCents, aceite: aceito })
        : await servico.criarAssinatura({ planCode: PLANO_PAGO, valorConfirmadoCentavos: oferta.priceCents, aceite: aceito });
      if (resposta?.checkoutUrl) {
        setStatus(atual => atual ? { ...atual, checkoutUrl: resposta.checkoutUrl } : atual);
        setConfirmando(false); setAceito(false);
        await atualizar().catch(() => {});
      }
      else { setStatus(await servico.obterStatus()); setConfirmando(false); setAceito(false); }
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
              Você pode aceitar 5 agendamentos por mês gratuitamente. No plano Pro você aceita pedidos sem limite mensal. Pague com Pix, boleto ou cartão na fatura do Asaas.
            </p>
            {oferta ? <p className="font-semibold text-slate-800">{oferta.name}: {precoMensal(oferta.priceCents)}/mês{status.testeDisponivel && !subscription && oferta.trialDays ? ` após ${oferta.trialDays} dias grátis` : ""}.</p> : <p role="status">Não foi possível carregar o preço do Pro. Atualize a página para contratar.</p>}
            {confirmando && oferta ? <>
              <ResumoContratacao plano={oferta} testeDisponivel={status.testeDisponivel && !subscription} aceito={aceito} onAceite={setAceito} disabled={enviando} />
              <button className={botaoPrimario} disabled={enviando || !aceito} onClick={assinar}>{enviando ? "Processando..." : `Confirmar ${oferta.name} — ${precoMensal(oferta.priceCents)}/mês`}</button>
              <button type="button" disabled={enviando} onClick={() => { setConfirmando(false); setAceito(false); }}>Voltar</button>
            </> : <button type="button" className={botaoPrimario} disabled={!oferta || enviando} onClick={() => setConfirmando(true)}>Ver e contratar Pro</button>}
          </>
        )
      ) : null}
      {erro ? <Alerta>{erro}</Alerta> : null}
    </section>
  );
}
