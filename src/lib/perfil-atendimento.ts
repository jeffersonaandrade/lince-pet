export const PERFIS_ATENDIMENTO = [
  { value: "veterinario", label: "Clínica veterinária (com ou sem exames)" },
  { value: "exames", label: "Centro de exames ou laboratório veterinário" },
] as const;

export type PerfilAtendimento = typeof PERFIS_ATENDIMENTO[number]["value"];

export function perfilAtendimentoValido(valor: unknown): valor is PerfilAtendimento {
  return PERFIS_ATENDIMENTO.some(({ value }) => value === valor);
}

export const AREAS_DE_EXAMES: ReadonlyArray<string> = [
  "Diagnóstico por Imagem Veterinária",
  "Patologia clínica veterinária",
  "Patologia Veterinária",
];

const COMODIDADES_DE_EXAMES = new Set([
  "estacionamento", "acessibilidade", "arcondicionado", "wifi",
  "salaespera", "banheiro", "atendimento24h",
]);

export function comodidadeDeCentroDeExames(chave: string) {
  return COMODIDADES_DE_EXAMES.has(chave);
}
