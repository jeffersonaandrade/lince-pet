"use client";

import { useEffect, useState } from "react";
import { CalendarCheck } from "lucide-react";
import { api } from "@/hook/api";

type Compromisso = {
  id: string;
  horario_consulta: string | null;
  status: string;
  local_nome: string | null;
  pet?: { nome: string } | null;
  veterinario?: { nome: string; sobrenome?: string | null } | null;
  prestador?: { nome: string; sobrenome?: string | null; servico?: string | null; periodo?: string | null } | null;
};

type Props = {
  /** YYYY-MM-DD */
  data: string | null;
  /** HH:mm escolhido no destino; marca os compromissos que caem perto dele. */
  horario?: string | null;
  /** Janela considerada ocupada por compromisso, em minutos. */
  duracaoMin?: number;
};

const minutos = (h: string) => {
  const [hh, mm] = h.split(":").map(Number);
  return hh * 60 + (mm || 0);
};

const CANCELADOS = ["cancelado", "cancelada"];

/** Compromissos do tutor no dia escolhido, para comparar com a agenda do destino do encaminhamento. */
export default function MinhaAgendaDoDia({ data, horario, duracaoMin = 60 }: Props) {
  const [itens, setItens] = useState<Compromisso[] | null>(null);

  useEffect(() => {
    if (!data) return;
    let ativo = true;
    setItens(null);
    api
      .get("/agendamentos", { params: { data_inicio: data, data_fim: data } })
      .then((r) => ativo && setItens((r.data.agendamentos || []).filter((a: Compromisso) => !CANCELADOS.includes(a.status))))
      .catch(() => ativo && setItens([]));
    return () => {
      ativo = false;
    };
  }, [data]);

  if (!data) return null;

  const conflita = (a: Compromisso) =>
    Boolean(horario && a.horario_consulta) && Math.abs(minutos(a.horario_consulta!) - minutos(horario!)) < duracaoMin;
  const algumConflito = itens?.some(conflita);

  return (
    <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
      <p className="flex items-center gap-2 text-sm font-semibold text-slate-700">
        <CalendarCheck size={16} className="text-orange-500" />
        Sua agenda em {data.split("-").reverse().join("/")}
      </p>
      {itens === null ? (
        <p className="text-xs text-slate-500">Carregando...</p>
      ) : itens.length === 0 ? (
        <p className="text-xs text-slate-500">Você não tem compromissos neste dia.</p>
      ) : (
        <ul className="space-y-1">
          {itens.map((a) => {
            const quem = a.prestador
              ? `${a.prestador.servico || "Serviço"} com ${a.prestador.nome}`
              : a.veterinario
                ? `Consulta com Dr(a). ${a.veterinario.nome}`
                : "Compromisso";
            return (
              <li
                key={a.id}
                className={`rounded-lg px-2 py-1 text-xs ${conflita(a) ? "bg-red-50 text-red-700" : "bg-white text-slate-600"}`}
              >
                <strong>{a.horario_consulta || "--:--"}</strong> · {quem}
                {a.pet?.nome ? ` · ${a.pet.nome}` : ""}
                {a.local_nome ? ` · ${a.local_nome}` : ""}
              </li>
            );
          })}
        </ul>
      )}
      {algumConflito ? (
        <p className="text-xs font-semibold text-red-700">O horário escolhido fica perto de outro compromisso seu.</p>
      ) : null}
    </div>
  );
}
