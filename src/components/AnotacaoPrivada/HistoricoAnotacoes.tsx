"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, History, Lock } from "lucide-react";
import { AnotacoesService, type AnotacaoHistorico } from "@/services/veterinarios/anotacoes";
import { errorMessage } from "@/services/veterinarios/bloqueios";

const STATUS_PAGAMENTO_LABEL: Record<string, string> = { pago: "Pago", pendente: "Pendente", isento: "Isento" };
const FORMA_LABEL: Record<string, string> = {
  pix: "Pix",
  cartao: "Cartão",
  dinheiro: "Dinheiro",
  plano_pet: "Plano de saúde pet",
  outro: "Outro",
};

const formatarData = (iso?: string | null) => (iso ? iso.slice(0, 10).split("-").reverse().join("/") : "");

const resumoPagamento = (a: AnotacaoHistorico) =>
  [
    a.status_pagamento && STATUS_PAGAMENTO_LABEL[a.status_pagamento],
    a.forma_pagamento && FORMA_LABEL[a.forma_pagamento],
    a.forma_pagamento === "plano_pet" && a.plano_nome,
  ]
    .filter(Boolean)
    .join(" · ");

interface Props {
  agendamentoId: string | number;
  petNome?: string;
}

/** Histórico das anotações do próprio veterinário sobre o pet desta consulta (carrega ao abrir). */
export default function HistoricoAnotacoes({ agendamentoId, petNome }: Props) {
  const [aberto, setAberto] = useState(false);
  const [itens, setItens] = useState<AnotacaoHistorico[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const alternar = async () => {
    const abrir = !aberto;
    setAberto(abrir);
    if (!abrir || itens !== null) return;
    setLoading(true);
    setErro(null);
    try {
      setItens(await AnotacoesService.historico(agendamentoId));
    } catch (e) {
      setErro(errorMessage(e, "Não foi possível carregar o histórico."));
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="flex flex-col gap-3 rounded-xl border border-solid border-slate-200 bg-white p-4">
      <button
        type="button"
        onClick={alternar}
        aria-expanded={aberto}
        className="flex w-full cursor-pointer items-center justify-between gap-2 border-0 bg-transparent p-0 text-left"
      >
        <span className="flex items-center gap-2 text-sm font-bold text-slate-800">
          <History size={16} className="text-slate-500" />
          Histórico de anotações{petNome ? ` de ${petNome}` : " do pet"}
        </span>
        <span className="flex items-center gap-2 text-xs font-semibold text-slate-500">
          <Lock size={12} />
          só suas
          {aberto ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </span>
      </button>

      {aberto &&
        (loading ? (
          <p className="m-0 text-sm text-slate-500">Carregando...</p>
        ) : erro ? (
          <p role="alert" className="m-0 text-sm text-red-600">{erro}</p>
        ) : !itens || itens.length === 0 ? (
          <p className="m-0 text-sm text-slate-500">Nenhuma anotação anterior sua sobre este pet.</p>
        ) : (
          <ol className="m-0 flex list-none flex-col gap-2 p-0">
            {itens.map((a) => (
              <li key={a.id} className="flex flex-col gap-1 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700">
                <span className="font-semibold text-slate-800">
                  {formatarData(a.data_consulta)}
                  {a.horario_consulta ? ` às ${a.horario_consulta}` : ""}
                  {a.tipo_consulta ? ` · ${a.tipo_consulta}` : ""}
                </span>
                {(a.local_atendimento || resumoPagamento(a)) && (
                  <span className="text-xs text-slate-500">
                    {[a.local_atendimento, resumoPagamento(a)].filter(Boolean).join(" · ")}
                  </span>
                )}
                {a.observacoes && <p className="m-0 whitespace-pre-wrap">{a.observacoes}</p>}
              </li>
            ))}
          </ol>
        ))}
    </section>
  );
}
