"use client";

import { useState } from "react";
import { X, AlertTriangle } from "lucide-react";
import {
  BloqueiosService,
  DIAS_SEMANA_CURTO,
  errorMessage,
  type BloqueioPayload,
  type BloqueioScope,
  type ConflitoBloqueio,
} from "@/services/veterinarios/bloqueios";

const TIME_SLOTS = (() => {
  const slots: string[] = [];
  for (let hour = 7; hour <= 23; hour++) {
    const h = hour.toString().padStart(2, "0");
    slots.push(`${h}:00`, `${h}:30`);
  }
  return slots;
})();

/** Fim do intervalo é exclusivo: "das 11:00 até 17:00" bloqueia 11:00 ... 16:30. */
const END_SLOTS = [...TIME_SLOTS.slice(1), "24:00"];

const hojeISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const diaDaSemana = (iso: string) => new Date(`${iso}T00:00:00`).getDay();

const formatarData = (iso?: string | null) => (iso ? iso.split("-").reverse().join("/") : "");

interface Props {
  scope: BloqueioScope;
  defaultDate?: string;
  onClose: () => void;
  onSaved: (canceladas: number) => void;
}

export default function BloqueioAgendaModal({ scope, defaultDate, onClose, onSaved }: Props) {
  const inicial = defaultDate && defaultDate >= hojeISO() ? defaultDate : hojeISO();
  const [frequencia, setFrequencia] = useState<"pontual" | "semanal">("pontual");
  const [tipo, setTipo] = useState<"dia" | "periodo">("dia");
  const [dataInicio, setDataInicio] = useState(inicial);
  const [dataFim, setDataFim] = useState(inicial);
  const [semFim, setSemFim] = useState(true);
  const [diasSemana, setDiasSemana] = useState<number[]>([diaDaSemana(inicial)]);
  const [diaInteiro, setDiaInteiro] = useState(true);
  const [horarios, setHorarios] = useState<string[]>([]);
  const [intervaloDe, setIntervaloDe] = useState("12:00");
  const [intervaloAte, setIntervaloAte] = useState("18:00");
  const [motivo, setMotivo] = useState("");
  const [conflitos, setConflitos] = useState<ConflitoBloqueio[] | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const resetPreview = () => {
    setConflitos(null);
    setError(null);
  };

  const toggleHorario = (time: string) => {
    resetPreview();
    setHorarios((prev) => (prev.includes(time) ? prev.filter((t) => t !== time) : [...prev, time].sort()));
  };

  const adicionarIntervalo = () => {
    if (intervaloAte <= intervaloDe) {
      setError("O fim do intervalo deve ser depois do início.");
      return;
    }
    resetPreview();
    const novos = TIME_SLOTS.filter((t) => t >= intervaloDe && t < intervaloAte);
    setHorarios((prev) => [...new Set([...prev, ...novos])].sort());
  };

  const toggleDiaSemana = (dia: number) => {
    resetPreview();
    setDiasSemana((prev) => (prev.includes(dia) ? prev.filter((d) => d !== dia) : [...prev, dia].sort()));
  };

  const payload = (): BloqueioPayload => {
    const base = { horarios: diaInteiro ? null : horarios, motivo: motivo.trim() || null };
    if (frequencia === "semanal") {
      return { ...base, recorrente: true, dias_semana: diasSemana, data_inicio: dataInicio, data_fim: semFim ? null : dataFim };
    }
    return { ...base, recorrente: false, data_inicio: dataInicio, data_fim: tipo === "periodo" ? dataFim : dataInicio };
  };

  const handleSubmit = async () => {
    if (!diaInteiro && horarios.length === 0) {
      setError("Selecione ao menos um horário ou marque o dia inteiro.");
      return;
    }
    if (frequencia === "semanal" && diasSemana.length === 0) {
      setError("Selecione ao menos um dia da semana.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      if (conflitos === null) {
        const preview = await BloqueiosService.preview(scope, payload());
        if (preview.conflitos.length > 0) {
          setConflitos(preview.conflitos);
          return;
        }
      }
      const result = await BloqueiosService.criar(scope, payload());
      onSaved(result.conflitos.length);
    } catch (e) {
      setError(errorMessage(e, "Não foi possível bloquear a agenda."));
    } finally {
      setSaving(false);
    }
  };

  const inputClass =
    "w-full rounded-lg border border-solid border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus:border-orange-500 focus:outline-none";
  const tabClass = (active: boolean) =>
    `flex-1 cursor-pointer rounded-lg border border-solid px-3 py-2 text-sm font-semibold transition-colors ${
      active ? "border-orange-500 bg-orange-50 text-orange-600" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
    }`;
  const chipClass = (active: boolean) =>
    `cursor-pointer rounded-md border border-solid px-2.5 py-1 text-xs font-semibold ${
      active ? "border-slate-600 bg-slate-600 text-white" : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
    }`;
  const labelClass = "flex flex-1 flex-col gap-1 text-sm font-medium text-slate-700";

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="bloqueio-agenda-title"
        className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-0 border-b border-solid border-slate-200 px-5 py-4">
          <h2 id="bloqueio-agenda-title" className="m-0 text-lg font-bold text-slate-800">
            Bloquear agenda
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="cursor-pointer rounded-full border-0 bg-transparent p-1 text-slate-500 hover:bg-slate-100"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex flex-col gap-4 overflow-y-auto px-5 py-4">
          <p className="m-0 text-sm text-slate-500">
            O bloqueio não altera a grade semanal do perfil e pode ser removido a qualquer momento.
          </p>

          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium text-slate-700">Frequência</span>
            <div className="flex gap-2">
              <button type="button" className={tabClass(frequencia === "pontual")} onClick={() => { setFrequencia("pontual"); resetPreview(); }}>
                Pontual
              </button>
              <button type="button" className={tabClass(frequencia === "semanal")} onClick={() => { setFrequencia("semanal"); resetPreview(); }}>
                Toda semana
              </button>
            </div>
          </div>

          {frequencia === "pontual" ? (
            <>
              <div className="flex gap-2">
                <button type="button" className={tabClass(tipo === "dia")} onClick={() => { setTipo("dia"); resetPreview(); }}>
                  Um dia
                </button>
                <button type="button" className={tabClass(tipo === "periodo")} onClick={() => { setTipo("periodo"); resetPreview(); }}>
                  Período (ex.: uma semana)
                </button>
              </div>
              <div className="flex gap-3">
                <label className={labelClass}>
                  {tipo === "periodo" ? "De" : "Data"}
                  <input
                    type="date"
                    className={inputClass}
                    min={hojeISO()}
                    value={dataInicio}
                    onChange={(e) => {
                      resetPreview();
                      setDataInicio(e.target.value);
                      if (dataFim < e.target.value) setDataFim(e.target.value);
                    }}
                  />
                </label>
                {tipo === "periodo" && (
                  <label className={labelClass}>
                    Até
                    <input
                      type="date"
                      className={inputClass}
                      min={dataInicio}
                      value={dataFim}
                      onChange={(e) => { resetPreview(); setDataFim(e.target.value); }}
                    />
                  </label>
                )}
              </div>
            </>
          ) : (
            <>
              <div className="flex flex-col gap-2">
                <span className="text-sm font-medium text-slate-700">Repetir em</span>
                <div className="flex flex-wrap gap-2">
                  {DIAS_SEMANA_CURTO.map((nome, dia) => (
                    <button
                      key={nome}
                      type="button"
                      aria-pressed={diasSemana.includes(dia)}
                      onClick={() => toggleDiaSemana(dia)}
                      className={chipClass(diasSemana.includes(dia))}
                    >
                      {nome}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex gap-3">
                <label className={labelClass}>
                  A partir de
                  <input
                    type="date"
                    className={inputClass}
                    min={hojeISO()}
                    value={dataInicio}
                    onChange={(e) => {
                      resetPreview();
                      setDataInicio(e.target.value);
                      if (dataFim < e.target.value) setDataFim(e.target.value);
                    }}
                  />
                </label>
                <label className={labelClass}>
                  Até
                  <input
                    type="date"
                    className={`${inputClass} disabled:bg-slate-100 disabled:text-slate-400`}
                    min={dataInicio}
                    value={dataFim}
                    disabled={semFim}
                    onChange={(e) => { resetPreview(); setDataFim(e.target.value); }}
                  />
                </label>
              </div>
              <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-slate-700">
                <input type="checkbox" checked={semFim} onChange={(e) => { resetPreview(); setSemFim(e.target.checked); }} />
                Sem data final (até eu remover)
              </label>
            </>
          )}

          <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-slate-700">
            <input
              type="checkbox"
              checked={diaInteiro}
              onChange={(e) => { resetPreview(); setDiaInteiro(e.target.checked); }}
            />
            Bloquear o dia inteiro
          </label>

          {!diaInteiro && (
            <div className="flex flex-col gap-3">
              <div className="flex items-end gap-2">
                <label className={labelClass}>
                  Das
                  <select className={inputClass} value={intervaloDe} onChange={(e) => {
                      const de = e.target.value;
                      setIntervaloDe(de);
                      if (intervaloAte <= de) setIntervaloAte(END_SLOTS[TIME_SLOTS.indexOf(de)]);
                    }}>
                    {TIME_SLOTS.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </label>
                <label className={labelClass}>
                  Até
                  <select className={inputClass} value={intervaloAte} onChange={(e) => setIntervaloAte(e.target.value)}>
                    {END_SLOTS.filter((t) => t > intervaloDe).map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </label>
                <button
                  type="button"
                  onClick={adicionarIntervalo}
                  className="cursor-pointer whitespace-nowrap rounded-lg border border-solid border-slate-600 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Bloquear intervalo
                </button>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-slate-700">
                  Horários bloqueados{frequencia === "pontual" && tipo === "dia" ? "" : " (em cada dia)"}: {horarios.length}
                </span>
                {horarios.length > 0 && (
                  <button
                    type="button"
                    onClick={() => { resetPreview(); setHorarios([]); }}
                    className="cursor-pointer border-0 bg-transparent p-0 text-xs font-semibold text-orange-600 hover:underline"
                  >
                    Limpar
                  </button>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {TIME_SLOTS.map((time) => (
                  <button
                    key={time}
                    type="button"
                    onClick={() => toggleHorario(time)}
                    aria-pressed={horarios.includes(time)}
                    className={chipClass(horarios.includes(time))}
                  >
                    {time}
                  </button>
                ))}
              </div>
            </div>
          )}

          <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
            Motivo (opcional)
            <input
              type="text"
              className={inputClass}
              maxLength={255}
              placeholder="Ex.: congresso, folga, plantão em outra clínica"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
            />
          </label>

          {conflitos && conflitos.length > 0 && (
            <div className="rounded-xl border border-solid border-amber-300 bg-amber-50 p-3">
              <p className="m-0 flex items-center gap-2 text-sm font-semibold text-amber-800">
                <AlertTriangle size={16} />
                {conflitos.length === 1
                  ? "1 consulta será cancelada e o tutor será avisado:"
                  : `${conflitos.length} consultas serão canceladas e os tutores serão avisados:`}
              </p>
              <ul className="m-0 mt-2 flex list-none flex-col gap-1 p-0 text-sm text-amber-900">
                {conflitos.map((c) => (
                  <li key={c.id}>
                    {formatarData(c.data_consulta)} às {c.horario_consulta} — {c.tutor_nome || "Tutor"}
                    {c.pet_nome ? ` (${c.pet_nome})` : ""}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {error && (
            <p role="alert" className="m-0 text-sm font-medium text-red-600">
              {error}
            </p>
          )}
        </div>

        <div className="flex justify-end gap-2 border-0 border-t border-solid border-slate-200 px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            className="cursor-pointer rounded-lg border border-solid border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Voltar
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={saving}
            className={`cursor-pointer rounded-lg border-0 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60 ${
              conflitos?.length ? "bg-red-600 hover:bg-red-700" : "bg-orange-500 hover:bg-orange-600"
            }`}
          >
            {saving ? "Salvando..." : conflitos?.length ? "Bloquear e cancelar consultas" : "Bloquear"}
          </button>
        </div>
      </div>
    </div>
  );
}
