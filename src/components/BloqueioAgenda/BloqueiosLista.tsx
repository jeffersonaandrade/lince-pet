"use client";

import { useCallback, useEffect, useState } from "react";
import { Ban, Trash2 } from "lucide-react";
import BloqueioAgendaModal from "./BloqueioAgendaModal";
import {
  BloqueiosService,
  DIAS_SEMANA_CURTO,
  errorMessage,
  type BloqueioAgenda,
  type BloqueioScope,
} from "@/services/veterinarios/bloqueios";

const formatarData = (iso: string) => iso.split("-").reverse().join("/");

const descreverPeriodo = (b: BloqueioAgenda) => {
  if (b.recorrente) {
    const dias = b.dias_semana.map((d) => DIAS_SEMANA_CURTO[d]).join(", ");
    const ate = b.data_fim ? ` até ${formatarData(b.data_fim)}` : "";
    return `Toda semana (${dias}) · a partir de ${formatarData(b.data_inicio)}${ate}`;
  }
  return !b.data_fim || b.data_inicio === b.data_fim
    ? formatarData(b.data_inicio)
    : `${formatarData(b.data_inicio)} a ${formatarData(b.data_fim)}`;
};

/** Agrupa horários consecutivos de 30 min em faixas: 11:00, 11:30, 12:00 -> "11:00–12:30". */
const descreverHorarios = (horarios: string[]) => {
  const toMin = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
  const toHora = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
  const faixas: string[] = [];
  let inicio: number | null = null;
  let anterior = 0;
  for (const m of horarios.map(toMin).sort((a, b) => a - b)) {
    if (inicio !== null && m === anterior + 30) {
      anterior = m;
      continue;
    }
    if (inicio !== null) faixas.push(`${toHora(inicio)}–${toHora(anterior + 30)}`);
    inicio = m;
    anterior = m;
  }
  if (inicio !== null) faixas.push(`${toHora(inicio)}–${toHora(anterior + 30)}`);
  return faixas.join(", ");
};

interface Props {
  scope: BloqueioScope;
  defaultDate?: string;
  /** Chamado após carregar/alterar os bloqueios (ex.: para marcar o calendário). */
  onChange?: (bloqueios: BloqueioAgenda[]) => void;
  /** Chamado quando um bloqueio cancelou consultas (para recarregar a agenda). */
  onAppointmentsCancelled?: () => void;
}

export default function BloqueiosLista({ scope, defaultDate, onChange, onAppointmentsCancelled }: Props) {
  const [bloqueios, setBloqueios] = useState<BloqueioAgenda[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const scopeKey = scope.tipo === "clinica" ? scope.veterinarioId : "self";

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      const data = await BloqueiosService.listar(scope);
      setBloqueios(data);
      onChange?.(data);
    } catch (e) {
      setFeedback(errorMessage(e, "Não foi possível carregar os bloqueios."));
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scopeKey]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const remover = async (id: string) => {
    if (!window.confirm("Remover este bloqueio? Os horários voltam a ficar disponíveis.")) return;
    try {
      await BloqueiosService.remover(scope, id);
      setFeedback("Bloqueio removido.");
      await carregar();
    } catch (e) {
      setFeedback(errorMessage(e, "Não foi possível remover o bloqueio."));
    }
  };

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-solid border-slate-200 bg-white p-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="m-0 flex items-center gap-2 text-base font-bold text-slate-800">
          <Ban size={18} className="text-slate-500" />
          Bloqueios de agenda
        </h3>
        <button
          type="button"
          onClick={() => { setFeedback(null); setModalOpen(true); }}
          className="cursor-pointer rounded-lg border-0 bg-orange-500 px-3 py-2 text-sm font-semibold text-white hover:bg-orange-600"
        >
          Bloquear agenda
        </button>
      </div>

      {feedback && <p className="m-0 text-sm text-slate-600" role="status">{feedback}</p>}

      {loading ? (
        <p className="m-0 text-sm text-slate-500">Carregando...</p>
      ) : bloqueios.length === 0 ? (
        <p className="m-0 text-sm text-slate-500">Nenhum bloqueio futuro.</p>
      ) : (
        <ul className="m-0 flex list-none flex-col gap-2 p-0">
          {bloqueios.map((b) => (
            <li
              key={b.id}
              className="flex items-start justify-between gap-2 rounded-lg bg-slate-100 px-3 py-2 text-sm text-slate-700"
            >
              <div className="flex flex-col">
                <span className="font-semibold">{descreverPeriodo(b)}</span>
                <span className="text-slate-500">
                  {b.dia_inteiro ? "Dia inteiro" : descreverHorarios(b.horarios)}
                  {b.motivo ? ` · ${b.motivo}` : ""}
                </span>
              </div>
              <button
                type="button"
                onClick={() => remover(b.id)}
                aria-label="Remover bloqueio"
                title="Remover bloqueio"
                className="cursor-pointer rounded-md border-0 bg-transparent p-1 text-slate-500 hover:bg-slate-200 hover:text-red-600"
              >
                <Trash2 size={16} />
              </button>
            </li>
          ))}
        </ul>
      )}

      {modalOpen && (
        <BloqueioAgendaModal
          scope={scope}
          defaultDate={defaultDate}
          onClose={() => setModalOpen(false)}
          onSaved={async (canceladas) => {
            setModalOpen(false);
            setFeedback(
              canceladas > 0
                ? `Agenda bloqueada. ${canceladas} consulta(s) cancelada(s) e tutor(es) avisado(s).`
                : "Agenda bloqueada."
            );
            await carregar();
            if (canceladas > 0) onAppointmentsCancelled?.();
          }}
        />
      )}
    </div>
  );
}
