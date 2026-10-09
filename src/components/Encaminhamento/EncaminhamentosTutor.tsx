"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { EncaminhamentosService, linkAgendar, type Encaminhamento } from "@/services/encaminhamentos/encaminhamentos";
import { SeloEncaminhamento, SeloUrgencia, dataCurta } from "./SeloEncaminhamento";

const podeAgendar = (e: Encaminhamento) =>
  e.status === "aceito" && (!e.agendamento_destino || ["cancelado", "cancelada"].includes(e.agendamento_destino.status));

/** Encaminhamentos dos pets do tutor: status e atalho para agendar no destino quando aceito. */
export default function EncaminhamentosTutor() {
  const [lista, setLista] = useState<Encaminhamento[] | null>(null);

  useEffect(() => {
    EncaminhamentosService.doTutor().then(setLista).catch(() => setLista([]));
  }, []);

  if (!lista) return <p className="text-sm text-slate-500">Carregando...</p>;
  if (!lista.length) return <p className="text-sm text-slate-500">Nenhum encaminhamento por enquanto.</p>;

  return (
    <ul id="encaminhamentos" className="space-y-3">
      {lista.map((e) => (
        <li key={e.id} className="space-y-1 rounded-xl border border-slate-200 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-slate-800">{e.pet?.nome || "Pet"}</span>
            <span className="text-sm text-slate-500">→ {e.destino.nome}</span>
            <span className="text-xs text-slate-400">{e.destino.rotulo}</span>
            <SeloEncaminhamento encaminhamento={e} />
            <SeloUrgencia urgencia={e.urgencia} />
          </div>
          <p className="text-xs text-slate-500">
            Encaminhado por {e.origem.nome}
            {e.criado_em ? ` em ${dataCurta(e.criado_em)}` : ""}
          </p>
          <p className="whitespace-pre-wrap text-sm text-slate-700">{e.motivo}</p>
          {e.status === "enviado" ? (
            <p className="text-xs text-amber-700">Aguardando resposta de {e.destino.nome}.</p>
          ) : null}
          {e.status === "recusado" ? (
            <p className="text-xs text-red-600">
              Recusado{e.motivo_recusa ? `: ${e.motivo_recusa}` : ""}. Fale com {e.origem.nome} para outro destino.
            </p>
          ) : null}
          {e.agendamento_destino?.data && !podeAgendar(e) ? (
            <p className="text-xs text-blue-700">
              Agendado para {e.agendamento_destino.data.slice(0, 10).split("-").reverse().join("/")}
              {e.agendamento_destino.horario ? ` às ${e.agendamento_destino.horario}` : ""}
            </p>
          ) : null}
          {podeAgendar(e) ? (
            <Link
              href={linkAgendar(e)}
              className="mt-2 inline-flex items-center justify-center rounded-xl bg-orange-500 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-600"
            >
              Agendar com {e.destino.nome}
            </Link>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
