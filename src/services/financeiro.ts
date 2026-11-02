import { api } from "@/hook/api";
import type { DadosLancamento } from "@/lib/financeiro";
export type Lancamento = DadosLancamento & {
  id: string;
  pagoCentavos: number;
  estado: string;
  versao: number;
};
export type Baixa = {
  id: string;
  valorCentavos: number;
  data: string;
  forma: string;
  desfeita: number;
};
export type DetalheFinanceiro = Lancamento & {
  baixas: Baixa[];
  eventos: {
    id: string;
    acao: string;
    motivo: string | null;
    createdAt: string;
    dados: Record<string, unknown>;
  }[];
};
export type PainelFinanceiro = {
  podeEditar: boolean;
  perfil: string;
  mes: string;
  itens: Lancamento[];
  total: number;
  pagina: number;
  resumo: {
    recebido: number;
    pago: number;
    aReceber: number;
    aPagar: number;
    vencido: number;
  };
};
export type AtendimentoFinanceiro = {
  id: string;
  dataConsulta: string | null;
  status: string;
  precoConsulta: string | null;
  pet: { nome: string } | null;
  tutor: { user: { nome: string; sobrenome: string | null } | null } | null;
};
export const FinanceiroService = {
  painel: async (
    params: URLSearchParams,
    signal?: AbortSignal,
  ): Promise<PainelFinanceiro> =>
    (await api.get(`/financeiro?${params}`, { signal })).data,
  detalhe: async (id: string): Promise<DetalheFinanceiro> =>
    (await api.get(`/financeiro/${id}`)).data,
  criar: async (dados: Record<string, unknown>) =>
    api.post("/financeiro", dados),
  alterar: async (id: string, dados: Record<string, unknown>) =>
    api.patch(`/financeiro/${id}`, dados),
  atendimentos: async (mes: string): Promise<AtendimentoFinanceiro[]> =>
    (await api.get(`/financeiro/atendimentos?mes=${mes}`)).data,
  exportar: async (params: URLSearchParams) => {
    const { data } = await api.get(`/financeiro/exportar?${params}`, {
      responseType: "blob",
    });
    const url = URL.createObjectURL(data),
      a = document.createElement("a");
    a.href = url;
    a.download = "controle-financeiro.csv";
    a.click();
    URL.revokeObjectURL(url);
  },
};
