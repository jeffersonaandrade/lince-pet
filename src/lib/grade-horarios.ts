/** Blocos de 30 min de um dia civil (00:00 … 23:30). */
export const BLOCOS_30_MIN: string[] = Array.from({ length: 48 }, (_, i) => {
  const h = String(Math.floor(i / 2)).padStart(2, "0");
  const m = i % 2 ? "30" : "00";
  return `${h}:${m}`;
});

/** Fim exclusivo do intervalo: "até 18:00" bloqueia/marca até 17:30. Inclui 24:00. */
export const FIM_INTERVALO_SLOTS = [...BLOCOS_30_MIN.slice(1), "24:00"];

const minutos = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + (m || 0);
};

/**
 * Blocos de 30 min no intervalo [de, ate) — igual ao bloqueio de agenda.
 * Ex.: das 08:00 às 18:00 → 08:00 … 17:30.
 */
export function blocosNoIntervalo(de: string, ate: string): string[] {
  if (!de || !ate || ate <= de) return [];
  const ini = minutos(de);
  const fim = ate === "24:00" ? 24 * 60 : minutos(ate);
  return BLOCOS_30_MIN.filter((t) => {
    const m = minutos(t);
    return m >= ini && m < fim;
  });
}

export const diaInteiro24h = () => [...BLOCOS_30_MIN];

export function unirHorarios(...listas: string[][]): string[] {
  return [...new Set(listas.flat())].sort((a, b) => a.localeCompare(b));
}
