import { describe, expect, it } from "vitest";
import {
  dinheiroEmCentavos,
  dataFinanceiro,
  estadoFinanceiro,
  podeEscreverFinanceiro,
  validarLancamento,
  celulaCsv,
} from "@/lib/financeiro";
describe("controle financeiro", () => {
  it("converte valores sem arredondamento silencioso", () => {
    expect(dinheiroEmCentavos("300,50")).toBe(30050);
    expect(dinheiroEmCentavos("0.01")).toBe(1);
    for (const v of ["0", "-10", "1,234", "1.000,00", "Infinity", "1e3", "abc"])
      expect(() => dinheiroEmCentavos(v)).toThrow();
  });
  it("valida datas de calendário, inclusive ano bissexto", () => {
    expect(dataFinanceiro("2028-02-29")).toBe("2028-02-29");
    for (const v of [
      "2026-02-29",
      "2026-02-31",
      "2026-13-01",
      "2026-00-00",
      "2026-11-01T00:00:00Z",
    ])
      expect(() => dataFinanceiro(v)).toThrow();
  });
  it("permite escrita somente nos planos e perfis combinados", () => {
    expect(podeEscreverFinanceiro("veterinario", "vet_pro")).toBe(true);
    expect(podeEscreverFinanceiro("clinica", "clinic_pro")).toBe(true);
    for (const perfil of ["veterinario", "clinica", "tutor", "prestador"])
      for (const plano of [
        "free",
        "none",
        "starter",
        "clinic",
        "pro",
        undefined,
      ])
        expect(podeEscreverFinanceiro(perfil, plano)).toBe(false);
    expect(podeEscreverFinanceiro("veterinario", "clinic_pro")).toBe(false);
    expect(podeEscreverFinanceiro("clinica", "vet_pro")).toBe(false);
  });
  it("não aceita pagar mais que a dívida ou saldo negativo", () => {
    expect(estadoFinanceiro(30000, 0)).toBe("aberto");
    expect(estadoFinanceiro(30000, 10000)).toBe("parcial");
    expect(estadoFinanceiro(30000, 30000)).toBe("quitado");
    expect(() => estadoFinanceiro(30000, 30001)).toThrow();
    expect(() => estadoFinanceiro(30000, -1)).toThrow();
  });
  it("rejeita centavos fracionários e campos inválidos", () => {
    const base = {
      tipo: "receita",
      descricao: "Consulta",
      categoria: "Atendimento",
      contraparte: "Tutor",
      vencimento: "2026-11-02",
      valorCentavos: 30000,
    };
    expect(validarLancamento(base).agendamentoId).toBeNull();
    for (const patch of [
      { valorCentavos: 3.5 },
      { descricao: "" },
      { tipo: "saldo" },
      { valorCentavos: 1000000000 },
      { agendamentoId: "outro" },
    ])
      expect(() => validarLancamento({ ...base, ...patch })).toThrow();
  });
  it("neutraliza fórmulas, aspas e quebras em CSV", () => {
    expect(celulaCsv("=1+1")).toBe('"\'=1+1"');
    expect(celulaCsv("  @SUM(1)")).toBe('"\'  @SUM(1)"');
    expect(celulaCsv('Clínica "A"')).toBe('"Clínica ""A"""');
  });
});
