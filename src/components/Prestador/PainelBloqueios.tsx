"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import { PrestadoresService, type Bloqueio, type Pedido } from "@/services/prestadores/prestadores";
import { handleApiError } from "@/utils/errorHandler";
import { Alerta, Campo, Entrada, botaoPrimario, formatarPeriodo } from "./ui";

const dataBr = (iso: string) => iso.split("-").reverse().join("/");

function descrever(b: Bloqueio) {
  const dias = b.data_fim && b.data_fim !== b.data_inicio ? `${dataBr(b.data_inicio)} a ${dataBr(b.data_fim)}` : dataBr(b.data_inicio);
  return b.dia_inteiro || !b.horarios.length ? `${dias} · dia inteiro` : `${dias} · ${b.horarios.join(", ")}`;
}

export function PainelBloqueios({
  bloqueios,
  onAlterado,
}: {
  bloqueios: Bloqueio[];
  onAlterado: (bloqueios: Bloqueio[]) => void;
}) {
  const [inicio, setInicio] = useState("");
  const [fim, setFim] = useState("");
  const [horarios, setHorarios] = useState("");
  const [motivo, setMotivo] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [conflitos, setConflitos] = useState<Pedido[]>([]);

  const salvar = async () => {
    setSalvando(true);
    setErro(null);
    setConflitos([]);
    const lista = horarios
      .split(",")
      .map((h) => h.trim())
      .filter(Boolean);
    try {
      const novo = await PrestadoresService.bloquear({
        data_inicio: inicio,
        data_fim: fim || null,
        horarios: lista.length ? lista : null,
        motivo: motivo || null,
      });
      onAlterado([...bloqueios, novo]);
      setInicio("");
      setFim("");
      setHorarios("");
      setMotivo("");
    } catch (e: any) {
      setErro(handleApiError(e).message);
      setConflitos(e?.response?.data?.conflitos || []);
    } finally {
      setSalvando(false);
    }
  };

  const remover = async (id: string) => {
    try {
      await PrestadoresService.removerBloqueio(id);
      onAlterado(bloqueios.filter((b) => b.id !== id));
    } catch (e) {
      setErro(handleApiError(e).message);
    }
  };

  return (
    <section className="flex flex-col gap-4 rounded-3xl bg-white p-6 shadow-sm">
      <div>
        <h2 className="text-lg font-bold text-slate-800">Bloquear agenda</h2>
        <p className="text-sm text-slate-500">Folgas e indisponibilidades. Sem horários, bloqueia o dia inteiro.</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Campo label="De">
          <Entrada type="date" value={inicio} onChange={(e) => setInicio(e.target.value)} />
        </Campo>
        <Campo label="Até (opcional)">
          <Entrada type="date" min={inicio} value={fim} onChange={(e) => setFim(e.target.value)} />
        </Campo>
        <Campo label="Horários (opcional)" dica="Separados por vírgula, ex.: 09:00, 10:00">
          <Entrada value={horarios} onChange={(e) => setHorarios(e.target.value)} placeholder="Dia inteiro" />
        </Campo>
        <Campo label="Motivo (opcional)">
          <Entrada value={motivo} onChange={(e) => setMotivo(e.target.value)} />
        </Campo>
      </div>

      {erro ? (
        <Alerta>
          {erro}
          {conflitos.length ? (
            <ul className="mt-2 list-disc pl-5">
              {conflitos.map((c) => (
                <li key={c.id}>
                  {c.servico?.nome || "Pedido"} · {c.pet?.nome} · {formatarPeriodo(c.inicio_em, c.fim_em)}
                </li>
              ))}
            </ul>
          ) : null}
        </Alerta>
      ) : null}

      <div className="flex justify-end">
        <button className={botaoPrimario} disabled={!inicio || salvando} onClick={salvar}>
          {salvando ? "Salvando..." : "Bloquear"}
        </button>
      </div>

      {bloqueios.length ? (
        <ul className="flex flex-col divide-y divide-slate-100">
          {bloqueios.map((b) => (
            <li key={b.id} className="flex items-center justify-between gap-3 py-3 text-sm">
              <span className="text-slate-700">
                {descrever(b)}
                {b.motivo ? <span className="text-slate-400"> · {b.motivo}</span> : null}
              </span>
              <button
                onClick={() => remover(b.id)}
                aria-label="Remover bloqueio"
                className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-600"
              >
                <Trash2 size={16} />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
