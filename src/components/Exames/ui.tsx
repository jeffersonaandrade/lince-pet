import type { ReactNode } from "react";

export const campo =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-100";
export const botaoPrimario =
  "rounded-lg bg-orange-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-60";
export const botaoSecundario =
  "rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-60";
export const botaoPerigo =
  "rounded-lg border border-red-200 bg-white px-4 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50 disabled:opacity-60";

export function Secao({ titulo, descricao, children, rotulo }: { titulo: string; descricao?: string; children: ReactNode; rotulo?: string }) {
  return (
    <section aria-label={rotulo ?? titulo} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-lg font-bold text-slate-800">{titulo}</h2>
      {descricao ? <p className="mt-1 text-sm text-slate-500">{descricao}</p> : null}
      <div className="mt-4">{children}</div>
    </section>
  );
}

export function Campo({ rotulo, children, dica }: { rotulo: string; children: ReactNode; dica?: string }) {
  return (
    <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
      {rotulo}
      {children}
      {dica ? <span className="text-xs font-normal text-slate-500">{dica}</span> : null}
    </label>
  );
}

export function Mensagem({ texto, tipo = "erro" }: { texto: string | null; tipo?: "erro" | "ok" }) {
  if (!texto) return null;
  return (
    <p role={tipo === "erro" ? "alert" : "status"} className={`mt-3 text-sm ${tipo === "erro" ? "text-red-600" : "text-emerald-700"}`}>
      {texto}
    </p>
  );
}
