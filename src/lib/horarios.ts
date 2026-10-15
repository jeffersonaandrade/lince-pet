/** Grade semanal de horários: chave é o dia (`segunda`, `terca`...), valor são os horários `HH:mm`. */
export type GradeSemanal = Record<string, string[]>;

export const DIAS_SEMANA = ["domingo", "segunda", "terca", "quarta", "quinta", "sexta", "sabado"] as const;

/** "Segunda-feira", "TERÇA" e "terca" viram a mesma chave. */
export function normalizarDia(dia: string): string {
  return dia
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace("-feira", "")
    .trim();
}

/**
 * Normaliza a grade vinda da API (objeto ou JSON em texto, de bancos antigos).
 * Descarta dias cujo valor não é lista de horários.
 */
export function normalizarGrade(valor: unknown): GradeSemanal {
  let bruto = valor;
  if (typeof bruto === "string") {
    try {
      bruto = JSON.parse(bruto);
    } catch {
      return {};
    }
  }
  if (!bruto || typeof bruto !== "object" || Array.isArray(bruto)) return {};

  const grade: GradeSemanal = {};
  for (const [dia, horarios] of Object.entries(bruto)) {
    if (!Array.isArray(horarios)) continue;
    grade[normalizarDia(dia)] = horarios.filter((h): h is string => typeof h === "string");
  }
  return grade;
}

/** Dia da semana de uma data `YYYY-MM-DD`, no fuso local; `null` se a data for inválida. */
export function diaDaSemana(dataIso: string): (typeof DIAS_SEMANA)[number] | null {
  const data = new Date(`${dataIso}T00:00:00`);
  if (Number.isNaN(data.getTime())) return null;
  return DIAS_SEMANA[data.getDay()];
}

/** Aceita `DD/MM/YYYY` (formato da API) ou `YYYY-MM-DD` e devolve `YYYY-MM-DD`. */
export function dataParaIso(data: string | null | undefined): string {
  if (!data) return "";
  const partes = data.split("/");
  if (partes.length === 3) return `${partes[2]}-${partes[1]}-${partes[0]}`;
  return data.slice(0, 10);
}
