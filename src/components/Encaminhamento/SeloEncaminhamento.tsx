import type { Encaminhamento } from "@/services/encaminhamentos/encaminhamentos";

const CORES = {
  enviado: "bg-amber-100 text-amber-800",
  aceito: "bg-green-100 text-green-800",
  recusado: "bg-red-100 text-red-700",
  agendado: "bg-blue-100 text-blue-800",
} as const;

const ROTULOS = { enviado: "Enviado", aceito: "Aceito", recusado: "Recusado", agendado: "Agendado" } as const;

/** Enviado, aceito ou recusado; aceito com agendamento ativo aparece como "Agendado". */
export function SeloEncaminhamento({ encaminhamento }: { encaminhamento: Encaminhamento }) {
  const ag = encaminhamento.agendamento_destino;
  const agendado = encaminhamento.status === "aceito" && ag && !["cancelado", "cancelada"].includes(ag.status);
  const chave = agendado ? "agendado" : encaminhamento.status;
  return <span className={`rounded-full px-3 py-1 text-xs font-semibold ${CORES[chave]}`}>{ROTULOS[chave]}</span>;
}

export function SeloUrgencia({ urgencia }: { urgencia: Encaminhamento["urgencia"] }) {
  if (urgencia !== "prioritario") return null;
  return <span className="rounded-full bg-red-50 px-3 py-1 text-xs font-semibold text-red-700">Prioritário</span>;
}

export const dataCurta = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" }) : "";
