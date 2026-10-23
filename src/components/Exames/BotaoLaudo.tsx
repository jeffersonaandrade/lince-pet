"use client";

import { useState } from "react";
import { FileText } from "lucide-react";
import { mensagemDeErro } from "@/lib/erros";
import { ExamesService } from "@/services/exames/exames";

/** Abre o laudo pela URL assinada (expira em segundos, então é pedida a cada clique). */
export function BotaoLaudo({ agendamentoId, className }: { agendamentoId: string; className?: string }) {
  const [abrindo, setAbrindo] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function abrir() {
    setAbrindo(true);
    setErro(null);
    const aba = window.open("", "_blank");
    try {
      const url = await ExamesService.urlDoLaudo(agendamentoId);
      if (aba) aba.location.href = url;
      else window.location.href = url;
    } catch (error) {
      aba?.close();
      setErro(mensagemDeErro(error, "Não foi possível abrir o laudo."));
    } finally {
      setAbrindo(false);
    }
  }

  return (
    <span className="inline-flex flex-col">
      <button
        type="button"
        onClick={abrir}
        disabled={abrindo}
        className={
          className ??
          "inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-white px-4 py-2 text-sm font-medium text-emerald-700 transition hover:bg-emerald-50 disabled:opacity-60"
        }
      >
        <FileText size={16} /> {abrindo ? "Abrindo..." : "Ver laudo"}
      </button>
      {erro ? <span role="alert" className="mt-1 text-xs text-red-600">{erro}</span> : null}
    </span>
  );
}
