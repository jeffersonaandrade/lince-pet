import { api } from "@/hook/api";

export type StatusLabel = "ativa" | "pendente" | "cancelada" | "inadimplente" | "cancelamento_pendente";

export type RespostaContratacao = {
  subscription: { id: string } | null;
  checkoutUrl: string | null;
  emTeste: boolean;
  primeiraFatura: string | null;
  message?: string;
};

export type StatusAssinatura = {
  plan: { code: string; name: string; priceCents: number; maxVeterinarios?: number | null } | null;
  usage: { used: number; limit: number | null };
  subscription: { id: string; status: string; asaasSubscriptionId: string | null; trialEnd: string | null } | null;
  statusLabel: StatusLabel | null;
  emTeste: boolean;
  trialEnd: string | null;
  testeDisponivel: boolean;
  pendingPlanId: string | null;
  checkoutUrl: string | null;
  cancelamentoPendente: boolean;
  cancelamentoSolicitado: boolean;
  acessoCortesia?: boolean;
};

export type PlanoBackend = { id: string; code: string; name: string; priceCents: number; trialDays: number | null };

export function AssinaturasService() {
  return {
    async prepararPagamento(): Promise<{ checkoutUrl: string | null }> {
      return (await api.post('/assinaturas/checkout')).data;
    },
    async listarPlanos(tipo?: "veterinario" | "clinica" | "prestador"): Promise<PlanoBackend[]> {
      const { data } = await api.get("/assinaturas/planos", { params: tipo ? { tipo } : {} });
      return data?.plans || [];
    },
    async criarAssinatura(params: { planCode: string; valorConfirmadoCentavos: number; aceite: boolean }): Promise<RespostaContratacao> {
      const { data } = await api.post("/assinaturas", params);
      return data;
    },
    async obterStatus({ incluirFatura = true }: { incluirFatura?: boolean } = {}): Promise<StatusAssinatura> {
      const { data } = await api.get("/assinaturas/status", { params: incluirFatura ? undefined : { incluir_fatura: '0' } });
      return data;
    },
    async upgrade(id: string, params: { planCode: string; valorConfirmadoCentavos: number; aceite: boolean }): Promise<RespostaContratacao> {
      const { data } = await api.patch(`/assinaturas/${id}/upgrade`, params);
      return data;
    },
    async cancelarAssinatura(id: string): Promise<{ cancelamentoPendente: boolean; message: string }> {
      const { data } = await api.delete(`/assinaturas/${id}`);
      return data;
    },
  };
}
