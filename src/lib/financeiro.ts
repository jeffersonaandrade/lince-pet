/** Regras monetárias e de acesso independentes de UI, HTTP e banco. Valores em centavos. */
export class ErroFinanceiro extends Error {
  constructor(
    message: string,
    public status = 422,
  ) {
    super(message);
  }
}
export const FORMAS_FINANCEIRO = [
  "Pix",
  "Dinheiro",
  "Cartão",
  "Transferência",
  "Outro",
] as const;
export type TipoFinanceiro = "receita" | "despesa";
export type DadosLancamento = {
  tipo: TipoFinanceiro;
  descricao: string;
  categoria: string;
  contraparte: string;
  vencimento: string;
  valorCentavos: number;
  agendamentoId: string | null;
};
export function podeEscreverFinanceiro(perfil: string, plano?: string | null) {
  return (
    (perfil === "veterinario" && plano === "vet_pro") ||
    (perfil === "clinica" && plano === "clinic_pro")
  );
}
export const hojeFinanceiro = () =>
  new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
export function dataFinanceiro(v: unknown): string {
  if (
    typeof v !== "string" ||
    !/^20\d{2}-\d{2}-\d{2}$/.test(v) ||
    !Number.isFinite(Date.parse(`${v}T12:00:00Z`)) ||
    new Date(`${v}T12:00:00Z`).toISOString().slice(0, 10) !== v
  )
    throw new ErroFinanceiro("Informe uma data válida entre 2000 e 2099.");
  return v;
}
export function centavos(v: unknown): number {
  if (
    typeof v !== "number" ||
    !Number.isSafeInteger(v) ||
    v <= 0 ||
    v > 999999999
  )
    throw new ErroFinanceiro(
      "O valor deve ser positivo, com até duas casas decimais e no máximo R$ 9.999.999,99.",
    );
  return v;
}
export function dinheiroEmCentavos(v: string) {
  if (!/^\d{1,7}([.,]\d{1,2})?$/.test(v.trim()))
    throw new ErroFinanceiro(
      "Informe um valor com até duas casas decimais, sem separador de milhar.",
    );
  const [inteiro, fracao = ""] = v.trim().replace(",", ".").split(".");
  return centavos(Number(inteiro) * 100 + Number(fracao.padEnd(2, "0")));
}
export function textoFinanceiro(v: unknown, campo: string, max: number) {
  if (typeof v !== "string" || !v.trim() || v.trim().length > max)
    throw new ErroFinanceiro(`${campo}: preencha entre 1 e ${max} caracteres.`);
  return v.trim();
}
export function uuidFinanceiro(v: unknown): string {
  if (
    typeof v !== "string" ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      v,
    )
  )
    throw new ErroFinanceiro("Identificador inválido.");
  return v;
}
export function validarLancamento(v: Record<string, unknown>): DadosLancamento {
  if (v.tipo !== "receita" && v.tipo !== "despesa")
    throw new ErroFinanceiro("Tipo de lançamento inválido.");
  if (v.agendamentoId && v.tipo !== "receita")
    throw new ErroFinanceiro(
      "Somente receitas podem ser vinculadas a atendimentos.",
    );
  return {
    tipo: v.tipo,
    descricao: textoFinanceiro(v.descricao, "Descrição", 160),
    categoria: textoFinanceiro(v.categoria, "Categoria", 60),
    contraparte: textoFinanceiro(v.contraparte, "Pagador ou favorecido", 160),
    vencimento: dataFinanceiro(v.vencimento),
    valorCentavos: centavos(v.valorCentavos),
    agendamentoId: v.agendamentoId ? uuidFinanceiro(v.agendamentoId) : null,
  };
}
export function estadoFinanceiro(valor: number, pago: number) {
  if (pago < 0 || pago > valor)
    throw new ErroFinanceiro(
      "O valor pago não pode superar o valor do lançamento.",
      409,
    );
  return pago === valor ? "quitado" : pago > 0 ? "parcial" : "aberto";
}
/** Evita fórmulas quando o CSV é aberto em uma planilha. */
export function celulaCsv(v: unknown) {
  const texto = String(v ?? "");
  return (
    '"' +
    (/^[\s]*[=+\-@\t\r\n]/.test(texto) ? "'" + texto : texto).replace(
      /"/g,
      '""',
    ) +
    '"'
  );
}
