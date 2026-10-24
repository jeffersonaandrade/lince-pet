"use client";

import { useEffect, useState } from "react";
import { AssinaturasService, type StatusAssinatura } from "@/services/assinaturas/assinaturas";
import { StatusAssinaturaAviso } from "./StatusAssinaturaAviso";

export function GerenciarAssinatura({ status, atualizar }: { status: StatusAssinatura; atualizar: () => Promise<void> }) {
  const [enviando, setEnviando] = useState(false);
  const [mensagem, setMensagem] = useState("");
  const [erro, setErro] = useState("");

  useEffect(() => {
    if (!status.cancelamentoPendente) return;
    const timer = setInterval(() => { atualizar().catch(() => {}); }, 10_000);
    return () => clearInterval(timer);
  }, [status.cancelamentoPendente, atualizar]);

  const cancelar = async () => {
    const id = status.subscription?.id;
    if (!id || !window.confirm("Cancelar a assinatura? O plano será encerrado após a confirmação do cancelamento. Pagamentos já feitos não são estornados automaticamente.")) return;
    setEnviando(true);
    setErro("");
    setMensagem("");
    try {
      const resposta = await AssinaturasService().cancelarAssinatura(id);
      setMensagem(resposta.cancelamentoPendente ? "" : resposta.message);
      await atualizar();
    } catch {
      setErro("Não foi possível confirmar o cancelamento. Atualize a situação antes de tentar novamente.");
      await atualizar().catch(() => {});
    } finally { setEnviando(false); }
  };
  const aberta = status.subscription && !["canceled", "expired"].includes(status.subscription.status);

  return (
    <section aria-label="Gerenciar assinatura" className="flex flex-col gap-3">
      <StatusAssinaturaAviso status={status} />
      {mensagem ? <p role="status" className="text-sm text-slate-700">{mensagem}</p> : null}
      {erro ? <p role="alert" className="text-sm text-red-700">{erro}</p> : null}
      <div className="mb-4 flex flex-wrap gap-3">
        {aberta && !status.cancelamentoSolicitado ? (
          <button type="button" disabled={enviando} onClick={cancelar} className="rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-700 disabled:opacity-50">
            {enviando ? "Solicitando cancelamento..." : "Cancelar assinatura"}
          </button>
        ) : null}
        {status.cancelamentoPendente || erro ? (
          <button type="button" disabled={enviando} onClick={() => atualizar().catch(() => setErro("Não foi possível atualizar a situação."))} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700">Atualizar situação</button>
        ) : null}
      </div>
    </section>
  );
}
