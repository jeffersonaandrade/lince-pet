"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Calendar } from "lucide-react";
import { API_BASE_URL } from "@/hook/api";
import { CanaisService, type CanaisNotificacao } from "@/services/notificacoes/canais";

type Aviso = (message: string, type?: "success" | "error") => void;

type Canal = "email" | "whatsapp";

const DESCRICOES: Record<Canal, { titulo: string; texto: string }> = {
  email: {
    titulo: "E-mail",
    texto: "Confirmação, cancelamento e remarcação de consultas no e-mail do cadastro.",
  },
  whatsapp: {
    titulo: "WhatsApp",
    texto: "Avisos e lembretes (24h e 2h antes) enviados pelo número da Lince Pet para o celular do cadastro.",
  },
};

/**
 * Canais de aviso de consultas do usuário logado (tutor ou veterinário).
 * E-mail e WhatsApp salvam na hora; o Google Agenda entra como `children` (ConexaoGoogleAgenda).
 */
export function PreferenciasNotificacao({ onAviso, children }: { onAviso: Aviso; children?: ReactNode }) {
  const [canais, setCanais] = useState<CanaisNotificacao | null>(null);
  const [salvando, setSalvando] = useState<Canal | null>(null);

  useEffect(() => {
    CanaisService.obter()
      .then(setCanais)
      .catch(() => onAviso("Não foi possível carregar suas preferências de aviso.", "error"));
  }, [onAviso]);

  const alternar = async (canal: Canal, ligado: boolean) => {
    setSalvando(canal);
    setCanais((atual) => (atual ? { ...atual, [canal]: ligado } : atual));
    try {
      setCanais(await CanaisService.salvar({ [canal]: ligado }));
      onAviso("Preferência de aviso salva.");
    } catch {
      setCanais((atual) => (atual ? { ...atual, [canal]: !ligado } : atual));
      onAviso("Erro ao salvar a preferência de aviso.", "error");
    } finally {
      setSalvando(null);
    }
  };

  return (
    <section className="flex flex-col gap-4" onChange={(e) => e.stopPropagation()}>
      <div>
        <h2 className="text-lg font-bold text-slate-800">Avisos de consulta</h2>
        <p className="text-sm text-slate-500">
          Escolha por onde quer ser avisado. Os avisos dentro do app continuam sempre ligados.
        </p>
      </div>

      <div className="flex flex-col gap-3">
        {(Object.keys(DESCRICOES) as Canal[]).map((canal) => (
          <label
            key={canal}
            className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 bg-white p-4"
          >
            <input
              type="checkbox"
              className="mt-1 h-4 w-4 accent-orange-500"
              checked={canais?.[canal] ?? true}
              disabled={!canais || salvando === canal}
              onChange={(e) => alternar(canal, e.target.checked)}
            />
            <span className="flex flex-col gap-1">
              <span className="text-sm font-semibold text-slate-800">{DESCRICOES[canal].titulo}</span>
              <span className="text-xs text-slate-500">{DESCRICOES[canal].texto}</span>
            </span>
          </label>
        ))}
        {children}
      </div>
    </section>
  );
}

/**
 * Conexão com o Google Agenda: conectado = canal ativo. Desconectar para de criar eventos
 * e não apaga consultas nem eventos já criados. `bloqueio` substitui o botão de conectar (ex.: plano).
 */
export function ConexaoGoogleAgenda({
  conectado,
  onAlterado,
  onAviso,
  bloqueio,
}: {
  conectado: boolean;
  onAlterado: () => void | Promise<void>;
  onAviso: Aviso;
  bloqueio?: ReactNode;
}) {
  const [desconectando, setDesconectando] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const resultado = params.get("google_calendar");
    const erro = params.get("google_calendar_error");
    if (!resultado && !erro) return;
    window.history.replaceState({}, "", window.location.pathname);
    if (resultado === "success") {
      onAviso("Google Agenda conectado com sucesso!");
      onAlterado();
    } else {
      onAviso("Falha ao autorizar o Google Agenda.", "error");
    }
  }, [onAviso, onAlterado]);

  const conectar = () => {
    const redirectTo = window.location.origin + window.location.pathname;
    window.location.href = `${API_BASE_URL}/google/calendar/auth?redirect_to=${encodeURIComponent(redirectTo)}`;
  };

  const desconectar = async () => {
    if (!window.confirm("Desconectar o Google Agenda? Novas consultas deixam de entrar na sua agenda.")) return;
    setDesconectando(true);
    try {
      await CanaisService.desconectarGoogleAgenda();
      onAviso("Google Agenda desconectado.");
      await onAlterado();
    } catch {
      onAviso("Erro ao desconectar o Google Agenda.", "error");
    } finally {
      setDesconectando(false);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-4 rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50">
        <Calendar size={22} color="#4285f4" />
      </div>
      <div className="flex min-w-[200px] flex-1 flex-col gap-1">
        <span className="text-sm font-semibold text-slate-800">Google Agenda</span>
        <span className="text-xs text-slate-500">
          Consultas marcadas, remarcadas ou canceladas atualizam o evento na sua agenda do Google.
        </span>
        <span className={`text-xs font-semibold ${conectado ? "text-green-600" : "text-slate-400"}`}>
          ● {conectado ? "Conectado" : "Não conectado"}
        </span>
      </div>
      {conectado ? (
        <button
          type="button"
          onClick={desconectar}
          disabled={desconectando}
          className="rounded-lg border border-red-200 bg-white px-4 py-2 text-sm font-semibold text-red-600 hover:bg-red-50 disabled:opacity-60"
        >
          {desconectando ? "Desconectando..." : "Desconectar"}
        </button>
      ) : bloqueio ? (
        bloqueio
      ) : (
        <button
          type="button"
          onClick={conectar}
          className="rounded-lg bg-blue-500 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-600"
        >
          Conectar agenda
        </button>
      )}
    </div>
  );
}
