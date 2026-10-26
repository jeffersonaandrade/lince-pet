"use client";

import { useState } from "react";
import { VeterinarioDashboardService } from "@/services/veterinarios/dashboard";

export function AceitarDomicilio({
  id,
  tipo,
  status,
  onAceito,
}: {
  id: string | number;
  tipo?: string;
  status?: string;
  onAceito: (id: string | number, endereco: string) => void;
}) {
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  if (tipo !== "domicilio" || (status || "").toLowerCase() !== "pendente") return null;

  return (
    <div className="mt-2 flex flex-col items-start gap-2" onClick={(event) => event.stopPropagation()}>
      <p className="text-xs text-slate-500">O endereço completo aparece depois do aceite.</p>
      <button
        type="button"
        className="rounded-lg bg-[var(--primary)] px-3 py-2 text-sm font-semibold text-white hover:bg-[var(--primary-dark)] disabled:opacity-60"
        disabled={ocupado}
        onClick={async () => {
          setOcupado(true);
          setErro(null);
          const resultado = await VeterinarioDashboardService.aceitarDomicilio(id);
          setOcupado(false);
          if (!resultado.ok) {
            setErro(resultado.error || "Não foi possível aceitar o atendimento.");
            return;
          }
          onAceito(id, resultado.localEndereco ?? "");
        }}
      >
        {ocupado ? "Aceitando..." : "Aceitar atendimento"}
      </button>
      {erro ? (
        <p role="alert" className="text-sm text-red-700">
          {erro}
        </p>
      ) : null}
    </div>
  );
}
