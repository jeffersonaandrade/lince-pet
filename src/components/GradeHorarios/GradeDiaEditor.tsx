"use client";

import { useState } from "react";
import {
  BLOCOS_30_MIN,
  FIM_INTERVALO_SLOTS,
  blocosNoIntervalo,
  diaInteiro24h,
  unirHorarios,
} from "@/lib/grade-horarios";

type Props = {
  label: string;
  value: string[];
  onChange: (horarios: string[]) => void;
  disabled?: boolean;
};

const campo =
  "rounded-lg border border-solid border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-800 focus:border-orange-500 focus:outline-none";
const chip = (ativo: boolean) =>
  `min-w-14 cursor-pointer rounded-md border border-solid px-2 py-1 text-xs font-semibold transition-colors ${
    ativo
      ? "border-[var(--primary)] bg-[var(--primary)] text-white"
      : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
  }`;

/** Editor de um dia da grade: clique unitário, intervalo (de/até) e aberto 24h. */
export default function GradeDiaEditor({ label, value, onChange, disabled }: Props) {
  const [de, setDe] = useState("08:00");
  const [ate, setAte] = useState("18:00");
  const selecionados = new Set(value);

  const aplicarIntervalo = () => {
    const novos = blocosNoIntervalo(de, ate);
    if (!novos.length) return;
    onChange(unirHorarios(value, novos));
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm font-semibold text-slate-800">
          {label}
          <span className="ml-2 font-normal text-slate-500">({value.length} blocos)</span>
        </span>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={disabled}
            onClick={() => onChange(diaInteiro24h())}
            className="cursor-pointer rounded-lg border border-solid border-slate-600 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            Aberto 24h
          </button>
          {value.length > 0 ? (
            <button
              type="button"
              disabled={disabled}
              onClick={() => onChange([])}
              className="cursor-pointer border-0 bg-transparent p-0 text-xs font-semibold text-orange-600 hover:underline disabled:opacity-50"
            >
              Limpar
            </button>
          ) : null}
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-2">
        <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
          Das
          <select
            className={campo}
            value={de}
            disabled={disabled}
            onChange={(e) => {
              const novo = e.target.value;
              setDe(novo);
              if (ate <= novo) {
                const i = BLOCOS_30_MIN.indexOf(novo);
                setAte(FIM_INTERVALO_SLOTS[Math.min(i, FIM_INTERVALO_SLOTS.length - 1)]);
              }
            }}
          >
            {BLOCOS_30_MIN.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
          Até
          <select className={campo} value={ate} disabled={disabled} onChange={(e) => setAte(e.target.value)}>
            {FIM_INTERVALO_SLOTS.filter((t) => t > de).map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          disabled={disabled || ate <= de}
          onClick={aplicarIntervalo}
          className="cursor-pointer rounded-lg border border-solid border-slate-600 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          Marcar intervalo
        </button>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {BLOCOS_30_MIN.map((time) => {
          const ativo = selecionados.has(time);
          return (
            <button
              key={time}
              type="button"
              disabled={disabled}
              aria-pressed={ativo}
              onClick={() =>
                onChange(
                  ativo
                    ? value.filter((t) => t !== time)
                    : unirHorarios(value, [time])
                )
              }
              className={chip(ativo)}
            >
              {time}
            </button>
          );
        })}
      </div>
    </div>
  );
}
