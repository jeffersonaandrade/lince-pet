export type CriterioOrdenacao = "nome" | "nota";
export type DirecaoOrdenacao = "asc" | "desc";

type LeitorParams = { get(nome: string): string | null };

export function lerOrdenacao(params: LeitorParams): {
  criterio: CriterioOrdenacao;
  direcao: DirecaoOrdenacao;
} {
  const bruto = params.get("ordem");
  const criterio: CriterioOrdenacao = bruto === "nome" ? "nome" : "nota";
  const direcaoParam = params.get("direcao");
  const direcao: DirecaoOrdenacao =
    direcaoParam === "asc" || direcaoParam === "desc"
      ? direcaoParam
      : criterio === "nota"
        ? "desc"
        : "asc";
  return { criterio, direcao };
}

export function ordenarLista<T>(
  lista: readonly T[],
  criterio: CriterioOrdenacao,
  direcao: DirecaoOrdenacao,
  valor: (item: T) => { nome: string; nota: number },
): T[] {
  const fator = direcao === "asc" ? 1 : -1;
  return lista.toSorted((a, b) => {
    const va = valor(a);
    const vb = valor(b);
    if (criterio === "nome") {
      return va.nome.localeCompare(vb.nome, "pt-BR", { sensitivity: "base" }) * fator;
    }
    const notaA = Number.isFinite(va.nota) ? va.nota : 0;
    const notaB = Number.isFinite(vb.nota) ? vb.nota : 0;
    if (notaA === notaB) {
      return va.nome.localeCompare(vb.nome, "pt-BR", { sensitivity: "base" });
    }
    return (notaA - notaB) * fator;
  });
}
