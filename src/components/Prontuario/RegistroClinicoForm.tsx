"use client";

import { useEffect, useState } from "react";
import { Eye } from "lucide-react";
import {
  MAX_TEXTO_REGISTRO,
  PESO_MAXIMO_KG,
  ProntuarioService,
  type RegistroClinicoPayload,
} from "@/services/pets/prontuario";
import { errorMessage } from "@/services/veterinarios/bloqueios";

type CampoTexto = "queixa" | "diagnostico" | "tratamento" | "vacinas_medicacoes" | "encaminhamento";

const CAMPOS_TEXTO: { campo: CampoTexto; label: string; placeholder: string }[] = [
  { campo: "queixa", label: "Motivo / queixa principal", placeholder: "Por que o pet veio à consulta?" },
  { campo: "diagnostico", label: "Diagnóstico / avaliação", placeholder: "Achados do exame e avaliação" },
  { campo: "tratamento", label: "Tratamento / prescrição e orientações", placeholder: "Medicações, doses, cuidados em casa..." },
  { campo: "vacinas_medicacoes", label: "Vacinas / medicações aplicadas", placeholder: "Ex.: V10 (lote 123), vermífugo" },
  { campo: "encaminhamento", label: "Encaminhamento", placeholder: "Especialidade/profissional e motivo" },
];

const VAZIO: Record<CampoTexto, string> = {
  queixa: "",
  diagnostico: "",
  tratamento: "",
  vacinas_medicacoes: "",
  encaminhamento: "",
};

const hojeISO = () => new Date().toLocaleDateString("en-CA");

interface Props {
  agendamentoId: string | number;
}

/** Registro clínico da consulta: entra no prontuário do pet (visível ao tutor e a quem atende o pet). */
export default function RegistroClinicoForm({ agendamentoId }: Props) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ tipo: "ok" | "erro"; msg: string } | null>(null);
  const [textos, setTextos] = useState(VAZIO);
  const [peso, setPeso] = useState("");
  const [retorno, setRetorno] = useState("");
  const [plano, setPlano] = useState("");

  useEffect(() => {
    let ativo = true;
    setLoading(true);
    setFeedback(null);
    ProntuarioService.obterRegistro(agendamentoId)
      .then((r) => {
        if (!ativo) return;
        setTextos({
          queixa: r?.queixa || "",
          diagnostico: r?.diagnostico || "",
          tratamento: r?.tratamento || "",
          vacinas_medicacoes: r?.vacinas_medicacoes || "",
          encaminhamento: r?.encaminhamento || "",
        });
        setPeso(r?.peso_kg != null ? String(r.peso_kg) : "");
        setRetorno(r?.retorno_sugerido || "");
        setPlano(r?.plano_saude || "");
      })
      .catch((e) => ativo && setFeedback({ tipo: "erro", msg: errorMessage(e, "Não foi possível carregar o registro.") }))
      .finally(() => ativo && setLoading(false));
    return () => {
      ativo = false;
    };
  }, [agendamentoId]);

  const salvar = async () => {
    const pesoNum = peso.trim() ? Number(peso.replace(",", ".")) : null;
    if (pesoNum !== null && (Number.isNaN(pesoNum) || pesoNum < 0 || pesoNum > PESO_MAXIMO_KG)) {
      setFeedback({ tipo: "erro", msg: `Informe um peso entre 0 e ${PESO_MAXIMO_KG} kg.` });
      return;
    }
    if (retorno && retorno < hojeISO()) {
      setFeedback({ tipo: "erro", msg: "A data de retorno deve ser hoje ou uma data futura." });
      return;
    }

    setSaving(true);
    setFeedback(null);
    try {
      const payload: RegistroClinicoPayload = {
        queixa: textos.queixa.trim() || null,
        diagnostico: textos.diagnostico.trim() || null,
        tratamento: textos.tratamento.trim() || null,
        vacinas_medicacoes: textos.vacinas_medicacoes.trim() || null,
        encaminhamento: textos.encaminhamento.trim() || null,
        peso_kg: pesoNum,
        retorno_sugerido: retorno || null,
        plano_saude: plano.trim() || null,
      };
      await ProntuarioService.salvarRegistro(agendamentoId, payload);
      setFeedback({ tipo: "ok", msg: "Registro clínico salvo." });
    } catch (e) {
      setFeedback({ tipo: "erro", msg: errorMessage(e, "Não foi possível salvar o registro.") });
    } finally {
      setSaving(false);
    }
  };

  const inputClass =
    "w-full rounded-lg border border-solid border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus:border-orange-500 focus:outline-none";
  const labelClass = "flex flex-col gap-1 text-sm font-medium text-slate-700";

  return (
    <section className="flex flex-col gap-3 rounded-xl border border-solid border-orange-200 bg-orange-50 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h5 className="m-0 text-sm font-bold text-slate-800">Registro clínico</h5>
        <span className="flex items-center gap-1 rounded-full bg-orange-100 px-2 py-0.5 text-xs font-semibold text-orange-700">
          <Eye size={12} />
          Visível para o tutor e profissionais que atendem o pet
        </span>
      </div>

      {loading ? (
        <p className="m-0 text-sm text-slate-500">Carregando...</p>
      ) : (
        <>
          <div className="flex flex-col gap-3 sm:flex-row">
            <label className={`${labelClass} flex-1`}>
              Peso (kg)
              <input
                type="number"
                inputMode="decimal"
                min={0}
                max={PESO_MAXIMO_KG}
                step="0.01"
                className={inputClass}
                placeholder="Ex.: 12.5"
                value={peso}
                onChange={(e) => setPeso(e.target.value)}
              />
            </label>
            <label className={`${labelClass} flex-1`}>
              Retorno sugerido
              <input
                type="date"
                min={hojeISO()}
                className={inputClass}
                value={retorno}
                onChange={(e) => setRetorno(e.target.value)}
              />
            </label>
            <label className={`${labelClass} flex-1`}>
              Plano de saúde usado
              <input
                type="text"
                maxLength={255}
                className={inputClass}
                placeholder="Ex.: Petlove Saúde"
                value={plano}
                onChange={(e) => setPlano(e.target.value)}
              />
            </label>
          </div>

          {CAMPOS_TEXTO.map(({ campo, label, placeholder }) => (
            <label key={campo} className={labelClass}>
              {label}
              <textarea
                className={`${inputClass} min-h-[64px] resize-y`}
                maxLength={MAX_TEXTO_REGISTRO}
                placeholder={placeholder}
                value={textos[campo]}
                onChange={(e) => setTextos((t) => ({ ...t, [campo]: e.target.value }))}
              />
            </label>
          ))}

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
              {saving ? "Salvando..." : "Salvar registro"}
            </button>
          </div>
        </>
      )}
    </section>
  );
}
