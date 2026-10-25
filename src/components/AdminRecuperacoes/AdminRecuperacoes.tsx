"use client";

import { useCallback, useState } from "react";
import { api } from "@/hook/api";
import { mensagemDeErro } from "@/lib/erros";

type Pedido = { id: string; cnpj: string; emailOriginal: string; emailNovo: string; representante: string; relato: string; status: string; evidencia: string | null; faturamentoConferido: boolean; justificativa: string | null; administradorId: string | null; decididoEm: string | null };

function PedidoRecuperacao({ pedido, atualizar }: { pedido: Pedido; atualizar: () => Promise<void> }) {
  const [evidencia, setEvidencia] = useState("");
  const [justificativa, setJustificativa] = useState("");
  const [conferida, setConferida] = useState(false);
  const [faturamento, setFaturamento] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [aviso, setAviso] = useState("");
  async function decidir(decisao: "aprovar" | "reprovar") {
    if (decisao === "aprovar" && !window.confirm("Recuperar a conta original? A senha atual será invalidada, as sessões encerradas e o novo e-mail receberá a redefinição de senha.")) return;
    setEnviando(true); setAviso("");
    try {
      const resposta = await api.patch(`/admin/recuperacoes-cnpj/${pedido.id}`, { decisao, evidencia, justificativa, representacaoConferida: conferida, faturamentoConferido: faturamento });
      setAviso(resposta.data.message);
      await atualizar();
    } catch (erro) { setAviso(mensagemDeErro(erro, "Não foi possível registrar a decisão.")); }
    finally { setEnviando(false); }
  }
  return <article aria-label={`Recuperação ${pedido.cnpj}`} className="flex flex-col gap-3 rounded-xl border bg-white p-5">
    <h2 className="font-bold">CNPJ {pedido.cnpj} — {pedido.status}</h2>
    <p>Representante: {pedido.representante}</p><p>E-mail atual: {pedido.emailOriginal}</p><p>Novo e-mail confirmado: {pedido.emailNovo}</p>
    <p className="whitespace-pre-wrap">{pedido.relato}</p>
    {pedido.status === "pendente" ? <>
      <label className="flex flex-col gap-1">Referência da comprovação<textarea minLength={20} maxLength={2000} value={evidencia} onChange={e => setEvidencia(e.target.value)} className="rounded-lg border p-2" /></label>
      <p className="text-sm text-slate-600">Registre o protocolo/local privado da documentação e a diligência realizada. CNPJ público e e-mail confirmado não comprovam representação.</p>
      <label className="flex flex-col gap-1">Justificativa da decisão<textarea minLength={20} maxLength={2000} value={justificativa} onChange={e => setJustificativa(e.target.value)} className="rounded-lg border p-2" /></label>
      <label><input type="checkbox" checked={conferida} onChange={e => setConferida(e.target.checked)} /> Conferi a representação e a documentação da empresa.</label>
      <label><input type="checkbox" checked={faturamento} onChange={e => setFaturamento(e.target.checked)} /> Conferi e atualizei o contato de faturamento no Asaas, ou confirmei que não há cadastro de faturamento.</label>
      <p className="text-sm text-slate-600">Se houver Asaas, registre também a referência dessa conferência na comprovação. Esta ação preserva o plano e não altera cobranças nem contatos no provedor automaticamente.</p>
      <div className="flex flex-wrap gap-3"><button disabled={enviando || !conferida || !faturamento || evidencia.trim().length < 20 || justificativa.trim().length < 20} onClick={() => decidir("aprovar")} className="rounded-lg bg-orange-500 p-3 text-white disabled:opacity-50">Aprovar e recuperar acesso</button><button disabled={enviando || justificativa.trim().length < 20} onClick={() => decidir("reprovar")} className="rounded-lg border p-3 disabled:opacity-50">Reprovar solicitação</button></div>
    </> : <><p>Comprovação: {pedido.evidencia || "—"}</p><p>Faturamento conferido: {pedido.faturamentoConferido ? "Sim" : "Não"}</p><p>Justificativa: {pedido.justificativa}</p><p>Decisão por {pedido.administradorId}, em {pedido.decididoEm ? new Date(pedido.decididoEm).toLocaleString("pt-BR") : "—"}.</p></>}
    {aviso ? <p role="status">{aviso}</p> : null}
  </article>;
}
export default function AdminRecuperacoes({ iniciais }: { iniciais: Pedido[] }) {
  const [pedidos, setPedidos] = useState<Pedido[]>(iniciais);
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(false);
  const atualizar = useCallback(async () => {
    setCarregando(true);
    try { const resposta = await api.get("/admin/recuperacoes-cnpj"); setPedidos(resposta.data.pedidos); setErro(""); }
    catch (erro) { setErro(mensagemDeErro(erro, "Não foi possível carregar as solicitações.")); }
    finally { setCarregando(false); }
  }, []);
  return <section aria-label="Solicitações de recuperação" className="flex flex-col gap-4">
    <button type="button" disabled={carregando} onClick={atualizar} className="self-start rounded-lg border p-2 disabled:opacity-50">Atualizar solicitações</button>
    {erro ? <p role="alert">{erro}</p> : null}
    {carregando ? <p role="status">Atualizando solicitações...</p> : null}
    {pedidos.length === 0 && !carregando ? <p>Nenhuma solicitação confirmada.</p> : pedidos.map(pedido => <PedidoRecuperacao key={pedido.id} pedido={pedido} atualizar={atualizar} />)}
    <p className="text-sm text-slate-600">Exibindo até 100 solicitações mais recentes. A documentação deve permanecer em repositório privado sob controle da equipe.</p>
  </section>;
}
