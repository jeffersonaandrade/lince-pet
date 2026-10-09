"use client";

import { useEffect, useState } from "react";
import { Lock } from "lucide-react";
import {
  AnotacoesService,
  MAX_OBSERVACOES,
  type FormaPagamento,
  type StatusPagamento,
} from "@/services/veterinarios/anotacoes";
import { errorMessage } from "@/services/veterinarios/bloqueios";

const LOCAL_OUTRO = "__outro__";

const STATUS_OPCOES: { value: StatusPagamento; label: string }[] = [
  { value: "pago", label: "Pago" },
  { value: "pendente", label: "Pendente" },
  { value: "isento", label: "Isento" },
];

const FORMA_OPCOES: { value: FormaPagamento; label: string }[] = [
  { value: "pix", label: "Pix" },
  { value: "cartao", label: "Cartão" },
  { value: "dinheiro", label: "Dinheiro" },
  { value: "plano_pet", label: "Plano de saúde pet" },
  { value: "outro", label: "Outro" },
];

interface Props {
  agendamentoId: string | number;
  /** Rótulos dos locais do vet (endereços); Online e Domicílio são adicionados aqui. */
  locais: string[];
}

export default function AnotacaoPrivada({ agendamentoId, locais }: Props) {
  const opcoesLocal = [...locais, "Online", "Domicílio"];
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ tipo: "ok" | "erro"; msg: string } | null>(null);
  const [localSelect, setLocalSelect] = useState("");
  const [localOutro, setLocalOutro] = useState("");
  const [statusPagamento, setStatusPagamento] = useState<StatusPagamento | "">("");
  const [formaPagamento, setFormaPagamento] = useState<FormaPagamento | "">("");
  const [planoNome, setPlanoNome] = useState("");
  const [observacoes, setObservacoes] = useState("");

  useEffect(() => {
    let ativo = true;
    setLoading(true);
    setFeedback(null);
    AnotacoesService.obter(agendamentoId)
      .then((a) => {
        if (!ativo) return;
        const local = a?.local_atendimento || "";
        const conhecido = !local || opcoesLocal.includes(local);
        setLocalSelect(conhecido ? local : LOCAL_OUTRO);
        setLocalOutro(conhecido ? "" : local);
        setStatusPagamento(a?.status_pagamento || "");
        setFormaPagamento(a?.forma_pagamento || "");
        setPlanoNome(a?.plano_nome || "");
        setObservacoes(a?.observacoes || "");
      })
      .catch((e) => ativo && setFeedback({ tipo: "erro", msg: errorMessage(e, "Não foi possível carregar a anotação.") }))
      .finally(() => ativo && setLoading(false));
    return () => {
      ativo = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agendamentoId]);

  const salvar = async () => {
    setSaving(true);
    setFeedback(null);
    try {
      await AnotacoesService.salvar(agendamentoId, {
        local_atendimento: localSelect === LOCAL_OUTRO ? localOutro.trim() || null : localSelect || null,
        status_pagamento: statusPagamento || null,
        forma_pagamento: formaPagamento || null,
        plano_nome: formaPagamento === "plano_pet" ? planoNome.trim() || null : null,
        observacoes: observacoes.trim() || null,
      });
      setFeedback({ tipo: "ok", msg: "Anotação salva." });
    } catch (e) {
      setFeedback({ tipo: "erro", msg: errorMessage(e, "Não foi possível salvar a anotação.") });
    } finally {
      setSaving(false);
    }
  };

  const inputClass =
    "w-full rounded-lg border border-solid border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus:border-orange-500 focus:outline-none";
  const labelClass = "flex flex-col gap-1 text-sm font-medium text-slate-700";

  return (
    <section className="flex flex-col gap-3 rounded-xl border border-solid border-slate-200 bg-slate-50 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h5 className="m-0 text-sm font-bold text-slate-800">Minhas anotações</h5>
        <span className="flex items-center gap-1 rounded-full bg-slate-200 px-2 py-0.5 text-xs font-semibold text-slate-600">
          <Lock size={12} />
          Privado: só você vê
        </span>
      </div>

      {loading ? (
        <p className="m-0 text-sm text-slate-500">Carregando...</p>
      ) : (
        <>
          <label className={labelClass}>
            Local do atendimento
            <select className={inputClass} value={localSelect} onChange={(e) => setLocalSelect(e.target.value)}>
              <option value="">Selecione</option>
              {opcoesLocal.map((l) => (
                <option key={l} value={l}>{l}</option>
              ))}
              <option value={LOCAL_OUTRO}>Outro</option>
            </select>
          </label>
          {localSelect === LOCAL_OUTRO && (
            <input
              type="text"
              className={inputClass}
              maxLength={255}
              placeholder="Onde foi o atendimento?"
              aria-label="Outro local do atendimento"
              value={localOutro}
              onChange={(e) => setLocalOutro(e.target.value)}
            />
          )}

          <div className="flex flex-col gap-3 sm:flex-row">
            <label className={`${labelClass} flex-1`}>
              Pagamento
              <select
                className={inputClass}
                value={statusPagamento}
                onChange={(e) => setStatusPagamento(e.target.value as StatusPagamento | "")}
              >
                <option value="">Selecione</option>
                {STATUS_OPCOES.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </label>
            <label className={`${labelClass} flex-1`}>
              Forma de pagamento
              <select
                className={inputClass}
                value={formaPagamento}
                onChange={(e) => setFormaPagamento(e.target.value as FormaPagamento | "")}
              >
                <option value="">Selecione</option>
                {FORMA_OPCOES.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </label>
          </div>

          {formaPagamento === "plano_pet" && (
            <label className={labelClass}>
              Plano usado
              <input
                type="text"
                className={inputClass}
                maxLength={255}
                placeholder="Ex.: Petlove Saúde"
                value={planoNome}
                onChange={(e) => setPlanoNome(e.target.value)}
              />
            </label>
          )}

          <label className={labelClass}>
            Observações do paciente
            <textarea
              className={`${inputClass} min-h-[96px] resize-y`}
              maxLength={MAX_OBSERVACOES}
              placeholder="Queixa, conduta, medicações, retorno..."
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
            />
            <span className="self-end text-xs text-slate-400">
              {observacoes.length}/{MAX_OBSERVACOES}
            </span>
          </label>

          <div className="flex items-center justify-between gap-2">
            <span
              role="status"
              className={`text-sm ${feedback?.tipo === "erro" ? "text-red-600" : "text-green-700"}`}
            >
              {feedback?.msg}
            </span>
            <button
              type="button"
              onClick={salvar}
              disabled={saving}
              className="cursor-pointer rounded-lg border-0 bg-orange-500 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? "Salvando..." : "Salvar anotação"}
            </button>
          </div>
        </>
      )}
    </section>
  );
}
