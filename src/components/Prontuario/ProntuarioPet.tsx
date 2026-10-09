"use client";

import { useEffect, useState } from "react";
import { ChevronDown, ChevronUp, ClipboardList, Scale } from "lucide-react";
import {
  ProntuarioService,
  type ConsultaProntuario,
  type Prontuario,
  type RegistroClinico,
} from "@/services/pets/prontuario";
import { errorMessage } from "@/services/veterinarios/bloqueios";

const formatarData = (iso?: string | null) => (iso ? iso.slice(0, 10).split("-").reverse().join("/") : "");

const CAMPOS: { campo: keyof RegistroClinico; label: string }[] = [
  { campo: "queixa", label: "Motivo / queixa" },
  { campo: "diagnostico", label: "Diagnóstico" },
  { campo: "tratamento", label: "Tratamento / prescrição" },
  { campo: "vacinas_medicacoes", label: "Vacinas / medicações" },
  { campo: "encaminhamento", label: "Encaminhamento" },
  { campo: "plano_saude", label: "Plano de saúde" },
];

function ultimoPeso(consultas: ConsultaProntuario[]) {
  const c = consultas.find((c) => c.registro?.peso_kg != null);
  return c ? { peso: c.registro!.peso_kg!, data: c.data_consulta } : null;
}

function ItemConsulta({ consulta }: { consulta: ConsultaProntuario }) {
  const [aberto, setAberto] = useState(false);
  const r = consulta.registro;
  const subtitulo = [consulta.veterinario_nome, consulta.clinica_nome, consulta.local_nome].filter(Boolean).join(" · ");

  return (
    <li className="rounded-lg border border-solid border-slate-200 bg-white">
      <button
        type="button"
        onClick={() => setAberto(!aberto)}
        aria-expanded={aberto}
        className="flex w-full cursor-pointer items-start justify-between gap-2 border-0 bg-transparent px-3 py-2 text-left"
      >
        <span className="flex flex-col gap-0.5">
          <span className="text-sm font-semibold text-slate-800">
            {formatarData(consulta.data_consulta)}
            {consulta.horario_consulta ? ` às ${consulta.horario_consulta}` : ""}
            {consulta.tipo_consulta ? ` · ${consulta.tipo_consulta}` : ""}
          </span>
          {subtitulo && <span className="text-xs text-slate-500">{subtitulo}</span>}
        </span>
        <span className="flex shrink-0 items-center gap-2 text-xs font-semibold text-slate-500">
          {r ? "Com registro" : "Sem registro clínico"}
          {aberto ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </span>
      </button>

      {aberto && (
        <div className="flex flex-col gap-2 border-0 border-t border-solid border-slate-100 px-3 py-2 text-sm text-slate-700">
          {!r ? (
            <p className="m-0 text-slate-500">Sem registro clínico para esta consulta.</p>
          ) : (
            <>
              {(r.peso_kg != null || r.retorno_sugerido) && (
                <p className="m-0 text-xs text-slate-500">
                  {[
                    r.peso_kg != null && `Peso: ${r.peso_kg} kg`,
                    r.retorno_sugerido && `Retorno sugerido: ${formatarData(r.retorno_sugerido)}`,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              )}
              {CAMPOS.filter(({ campo }) => r[campo]).map(({ campo, label }) => (
                <div key={campo}>
                  <span className="text-xs font-semibold uppercase text-slate-500">{label}</span>
                  <p className="m-0 whitespace-pre-wrap">{String(r[campo])}</p>
                </div>
              ))}
            </>
          )}
        </div>
      )}
    </li>
  );
}

interface Props {
  petId: string;
  petNome?: string;
  /** Carrega só ao expandir (útil dentro de modais com outras seções). */
  recolhivel?: boolean;
}

/** Prontuário do pet: consultas não canceladas com o registro clínico de cada uma (somente leitura). */
export default function ProntuarioPet({ petId, petNome, recolhivel = false }: Props) {
  const [aberto, setAberto] = useState(!recolhivel);
  const [dados, setDados] = useState<Prontuario | null>(null);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (!aberto || dados) return;
    let ativo = true;
    setLoading(true);
    setErro(null);
    ProntuarioService.obter(petId)
      .then((d) => ativo && setDados(d))
      .catch((e) => ativo && setErro(errorMessage(e, "Não foi possível carregar o prontuário.")))
      .finally(() => ativo && setLoading(false));
    return () => {
      ativo = false;
    };
  }, [aberto, dados, petId]);

  const nome = dados?.pet.nome || petNome;
  const peso = dados ? ultimoPeso(dados.consultas) : null;

  return (
    <section className="flex flex-col gap-3 rounded-xl border border-solid border-slate-200 bg-slate-50 p-4">
      <button
        type="button"
        onClick={() => recolhivel && setAberto(!aberto)}
        aria-expanded={aberto}
        className={`flex w-full items-center justify-between gap-2 border-0 bg-transparent p-0 text-left ${recolhivel ? "cursor-pointer" : "cursor-default"}`}
      >
        <span className="flex items-center gap-2 text-sm font-bold text-slate-800">
          <ClipboardList size={16} className="text-slate-500" />
          Prontuário{nome ? ` de ${nome}` : " do pet"}
        </span>
        {recolhivel && (aberto ? <ChevronUp size={16} /> : <ChevronDown size={16} />)}
      </button>

      {aberto &&
        (loading ? (
          <p className="m-0 text-sm text-slate-500">Carregando...</p>
        ) : erro ? (
          <p role="alert" className="m-0 text-sm text-red-600">{erro}</p>
        ) : !dados || dados.consultas.length === 0 ? (
          <p className="m-0 text-sm text-slate-500">Este pet ainda não tem registros.</p>
        ) : (
          <>
            {peso && (
              <p className="m-0 flex items-center gap-2 text-sm text-slate-700">
                <Scale size={14} className="text-slate-500" />
                Último peso: <strong>{peso.peso} kg</strong>
                {peso.data ? <span className="text-xs text-slate-500">({formatarData(peso.data)})</span> : null}
              </p>
            )}
            <ol className="m-0 flex list-none flex-col gap-2 p-0">
              {dados.consultas.map((c) => (
                <ItemConsulta key={c.agendamento_id} consulta={c} />
              ))}
            </ol>
          </>
        ))}
    </section>
  );
}
