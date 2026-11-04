"use client";

import GradeDiaEditor from "./GradeDiaEditor";
import { DIAS_SEMANA, type GradeSemanal } from "@/lib/horarios";
import { diaInteiro24h } from "@/lib/grade-horarios";

const NOMES = ["Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado"];

type Props = {
  value: GradeSemanal;
  onChange: (grade: GradeSemanal) => void;
  disabled?: boolean;
  /** Chaves dos dias; padrão `domingo`…`sabado`. */
  dias?: readonly string[];
  nomes?: string[];
  ajuda?: string;
};

/** Grade semanal com intervalo, 24h por dia e atalho para todos os dias 24h. */
export default function GradeSemanalEditor({
  value,
  onChange,
  disabled,
  dias = DIAS_SEMANA,
  nomes = NOMES,
  ajuda,
}: Props) {
  const setDia = (dia: string, horarios: string[]) => onChange({ ...value, [dia]: horarios });

  return (
    <div className="flex flex-col gap-4">
      {ajuda ? <p className="m-0 text-sm text-slate-500">{ajuda}</p> : null}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={disabled}
          onClick={() => {
            const todos = diaInteiro24h();
            onChange(Object.fromEntries(dias.map((d) => [d, [...todos]])));
          }}
          className="cursor-pointer rounded-lg border border-solid border-slate-600 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          Todos os dias 24h
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={() => onChange(Object.fromEntries(dias.map((d) => [d, []])))}
          className="cursor-pointer rounded-lg border border-solid border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
        >
          Limpar todos
        </button>
      </div>
      {dias.map((dia, i) => (
        <div key={dia} className="rounded-xl border border-solid border-slate-200 p-3">
          <GradeDiaEditor
            label={nomes[i] ?? dia}
            value={value[dia] ?? []}
            onChange={(horarios) => setDia(dia, horarios)}
            disabled={disabled}
          />
        </div>
      ))}
    </div>
  );
}
