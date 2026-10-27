"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { cartaoDePlano } from "@/config/planos";
import { AssinaturasService, type PlanoBackend } from "@/services/assinaturas/assinaturas";
import { handleApiError } from "@/utils/errorHandler";
import { ResumoContratacao, precoMensal } from "./ResumoContratacao";

/** Escolher antes do cadastro não cria assinatura nem concede acesso pago. */
export function EscolhaPlanoCadastro({ tipo, selecionado, onEscolha }: {
  tipo: "veterinario" | "prestador"; selecionado: PlanoBackend | null;
  onEscolha: (plano: PlanoBackend | null) => void;
}) {
  const [planos, setPlanos] = useState<PlanoBackend[]>([]);
  const [erro, setErro] = useState(false);
  const [tentativa, setTentativa] = useState(0);
  useEffect(() => {
    let ativo = true;
    AssinaturasService().listarPlanos(tipo).then(lista => {
      if (!ativo) return;
      const disponiveis = lista.filter(p => p.code === "free" || p.code === (tipo === "veterinario" ? "vet_pro" : "pro"));
      if (!disponiveis.some(p => p.code === "free") || disponiveis.length !== 2) throw new Error("Catálogo incompleto");
      setPlanos(disponiveis);
      onEscolha(disponiveis.find(p => p.code === "free")!);
    }).catch(() => { if (ativo) { setErro(true); onEscolha(null); } });
    return () => { ativo = false; };
  }, [tipo, tentativa, onEscolha]);
  return (
    <fieldset className="m-0 min-w-0 space-y-3 border-0 p-0">
      <legend className="font-[family-name:var(--font-heading)] text-lg font-semibold text-slate-700">Escolha seu plano</legend>
      <p className="text-sm text-slate-600">Gratuito: 5 agendamentos por mês, sem mensalidade. Pro: agendamentos ilimitados, com assinatura mensal. Sem período de teste nos planos individuais.</p>
      {erro ? <p role="alert">Não foi possível carregar os planos. <button type="button" className="underline" onClick={() => { setErro(false); setTentativa(v => v + 1); }}>Tentar novamente</button></p> : planos.length === 0 ? <p role="status">Carregando planos...</p> : null}
      <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2">
        {planos.map(plano => {
          const card = cartaoDePlano(plano);
          return <label key={plano.code} className={`min-w-0 cursor-pointer rounded-2xl border p-4 ${selecionado?.code === plano.code ? "border-[var(--primary)] bg-[var(--primary-light)]" : "border-slate-200 bg-white"}`}>
            <span className="flex items-center gap-2 font-[family-name:var(--font-heading)] text-lg font-semibold text-slate-700"><Image src={card.iconPath} alt="" width={32} height={32} /><input type="radio" className="accent-[var(--primary)]" name="planoCadastro" aria-label={plano.name} value={plano.code} checked={selecionado?.code === plano.code} onChange={() => onEscolha(plano)} />{plano.name}</span>
            <p className="my-2 text-xl font-bold text-[var(--primary)]">{plano.priceCents === 0 ? "Grátis" : `${precoMensal(plano.priceCents)}/mês`}</p>
            <ul className="space-y-1 text-sm text-slate-600">{card.benefits.map(beneficio => <li key={beneficio} className="flex gap-2"><span aria-hidden="true" className="text-[var(--primary)]">✓</span>{beneficio}</li>)}</ul>
          </label>;
        })}
      </div>
      <p className="text-sm text-slate-600">Escolher Pro não gera cobrança agora. Após criar a conta, você confirma o valor e segue para o pagamento. A liberação também depende das aprovações e da configuração do perfil.</p>
    </fieldset>
  );
}

export function ConfirmarPlanoCadastro({ plano, onContinuar }: { plano: PlanoBackend; onContinuar: () => void }) {
  const [aceito, setAceito] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [resposta, setResposta] = useState<string | null>(null);
  async function confirmar() {
    if (!aceito || enviando || resposta) return;
    setEnviando(true); setErro(null);
    try {
      const resultado = await AssinaturasService().criarAssinatura({ planCode: plano.code, valorConfirmadoCentavos: plano.priceCents, aceite: true });
      if (resultado.checkoutUrl) { window.location.assign(resultado.checkoutUrl); return; }
      setResposta(resultado.message || "Assinatura solicitada. Consulte a cobrança no painel para concluir o pagamento.");
    } catch (e) { setErro(handleApiError(e).message); }
    finally { setEnviando(false); }
  }
  return <section className="space-y-4" aria-label="Plano escolhido no cadastro">
    <h2 className="font-[family-name:var(--font-heading)] text-xl font-semibold text-slate-700">Conta criada. Confirme seu plano Pro</h2>
    <ResumoContratacao plano={plano} testeDisponivel={false} aceito={aceito} onAceite={setAceito} disabled={enviando || !!resposta} />
    {erro ? <p role="alert">{erro}</p> : null}
    {resposta ? <p role="status">{resposta}</p> : <button type="button" onClick={confirmar} disabled={!aceito || enviando} className="w-full rounded-xl bg-[var(--primary)] hover:bg-[var(--primary-dark)] p-3 font-bold text-white disabled:opacity-50">{enviando ? "Processando..." : `Confirmar ${plano.name} — ${precoMensal(plano.priceCents)}/mês`}</button>}
    <button type="button" disabled={enviando} onClick={onContinuar} className="w-full rounded-xl border border-slate-300 p-3 font-semibold">{resposta ? "Continuar para montar perfil" : "Continuar no Gratuito e montar perfil"}</button>
  </section>;
}
