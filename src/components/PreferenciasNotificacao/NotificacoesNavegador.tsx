"use client";

import { useEffect, useState } from "react";
import { NavegadorService, type EstadoNavegador } from "@/services/notificacoes/navegador";

type Aviso = (message: string, type?: "success" | "error") => void;

const STATUS: Record<EstadoNavegador, { texto: string; cor: string }> = {
  carregando: { texto: "Verificando...", cor: "text-slate-400" },
  nao_suportado: { texto: "Este navegador não suporta notificações. No iPhone, instale o site na tela inicial.", cor: "text-slate-400" },
  desligado_servidor: { texto: "Indisponível no momento.", cor: "text-slate-400" },
  bloqueado: { texto: "Bloqueadas nas configurações do navegador. Libere as notificações deste site para ativar.", cor: "text-red-600" },
  inativo: { texto: "Desativadas neste aparelho.", cor: "text-slate-400" },
  ativo: { texto: "Ativas neste aparelho.", cor: "text-green-600" },
};

/** Interruptor das notificações do navegador neste aparelho: espelham os avisos do sino. */
export function NotificacoesNavegador({ onAviso }: { onAviso: Aviso }) {
  const [estado, setEstado] = useState<EstadoNavegador>("carregando");
  const [salvando, setSalvando] = useState<"ativando" | "desativando" | null>(null);

  useEffect(() => {
    NavegadorService.estado()
      .then(setEstado)
      .catch(() => setEstado("desligado_servidor"));
  }, []);

  const alternar = async (ligar: boolean) => {
    setSalvando(ligar ? "ativando" : "desativando");
    try {
      const novo = ligar ? await NavegadorService.ativar() : await NavegadorService.desativar();
      setEstado(novo);
      if (ligar && novo !== "ativo") onAviso(STATUS[novo].texto, "error");
      else onAviso(ligar ? "Notificações do navegador ativadas." : "Notificações do navegador desativadas.");
    } catch {
      onAviso("Não foi possível alterar as notificações do navegador.", "error");
    } finally {
      setSalvando(null);
    }
  };

  const indisponivel = estado === "carregando" || estado === "nao_suportado" || estado === "desligado_servidor";

  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 bg-white p-4">
      <input
        type="checkbox"
        className="mt-1 h-4 w-4 accent-orange-500"
        checked={estado === "ativo"}
        disabled={indisponivel || salvando !== null}
        onChange={(e) => alternar(e.target.checked)}
      />
      <span className="flex flex-col gap-1">
        <span className="text-sm font-semibold text-slate-800">Notificações no navegador (este aparelho)</span>
        <span className="text-xs text-slate-500">
          Os mesmos avisos do sino aparecem como notificação do navegador, mesmo com o site em segundo plano.
        </span>
        <span className={`text-xs font-semibold ${salvando ? "text-slate-400" : STATUS[estado].cor}`}>
          ● {salvando === "ativando" ? "Ativando..." : salvando === "desativando" ? "Desativando..." : STATUS[estado].texto}
        </span>
      </span>
    </label>
  );
}
