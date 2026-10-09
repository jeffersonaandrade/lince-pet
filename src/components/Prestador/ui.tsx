import type { InputHTMLAttributes, ReactNode } from "react";

export const inputClass =
  "w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 outline-none transition focus:border-orange-400 focus:ring-2 focus:ring-orange-100 disabled:bg-slate-50";

export const botaoPrimario =
  "inline-flex items-center justify-center gap-2 rounded-xl bg-orange-500 px-5 py-3 text-sm font-semibold text-white transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-60";

export const botaoSecundario =
  "inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60";

export function Campo({
  label,
  erro,
  dica,
  children,
}: {
  label: string;
  erro?: string;
  dica?: string;
  children: ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm font-semibold text-slate-700">{label}</span>
      {children}
      {dica && !erro ? <span className="text-xs text-slate-500">{dica}</span> : null}
      {erro ? <span className="text-xs font-medium text-red-600">{erro}</span> : null}
    </label>
  );
}

export function Entrada({ invalido, className, ...props }: InputHTMLAttributes<HTMLInputElement> & { invalido?: boolean }) {
  return <input {...props} className={`${inputClass} ${invalido ? "border-red-400" : ""} ${className || ""}`} />;
}

export function Alerta({ tipo = "erro", children }: { tipo?: "erro" | "sucesso" | "info"; children: ReactNode }) {
  const cores = {
    erro: "border-red-200 bg-red-50 text-red-700",
    sucesso: "border-green-200 bg-green-50 text-green-700",
    info: "border-orange-200 bg-orange-50 text-orange-800",
  }[tipo];
  return <div className={`rounded-xl border px-4 py-3 text-sm ${cores}`}>{children}</div>;
}

export const DIAS_SEMANA = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

export const formatarPreco = (valor: number | null | undefined) =>
  valor === null || valor === undefined
    ? "-"
    : valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export const formatarDuracao = (min: number | null | undefined) => {
  if (!min) return "por diária";
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h ? `${h}h${m ? `${m}min` : ""}` : `${m}min`;
};

/** "12/10/2026 das 10:00 às 11:30" ou "12/10 10:00 até 15/10 10:00". */
export function formatarPeriodo(inicio: string | null, fim: string | null) {
  if (!inicio) return "-";
  const i = new Date(inicio);
  const f = fim ? new Date(fim) : i;
  const data = (d: Date) => d.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
  const hora = (d: Date) =>
    d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });
  return data(i) === data(f)
    ? `${data(i)} das ${hora(i)} às ${hora(f)}`
    : `${data(i)} ${hora(i)} até ${data(f)} ${hora(f)}`;
}

export const STATUS_PEDIDO: Record<string, { rotulo: string; cor: string }> = {
  pendente: { rotulo: "Aguardando aceite", cor: "bg-amber-100 text-amber-800" },
  confirmado: { rotulo: "Aceito", cor: "bg-green-100 text-green-800" },
  "em andamento": { rotulo: "Em andamento", cor: "bg-blue-100 text-blue-800" },
  realizado: { rotulo: "Concluído", cor: "bg-slate-100 text-slate-700" },
  cancelado: { rotulo: "Cancelado", cor: "bg-red-100 text-red-700" },
};

export function SeloStatus({ status }: { status: string }) {
  const s = STATUS_PEDIDO[status] || { rotulo: status, cor: "bg-slate-100 text-slate-700" };
  return <span className={`rounded-full px-3 py-1 text-xs font-semibold ${s.cor}`}>{s.rotulo}</span>;
}
