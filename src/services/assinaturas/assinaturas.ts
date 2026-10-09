import { api } from "@/hook/api";

export type StatusLabel = "ativa" | "pendente" | "cancelada" | "inadimplente";

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
};

export type PlanoBackend = { id: string; code: string; name: string; priceCents: number; trialDays: number | null };

export function AssinaturasService() {
  return {
    async listarPlanos() {
      const { data } = await api.get("/assinaturas/planos");
      return data?.plans || [];
    },
    async criarAssinatura(params: { planCode: string }): Promise<RespostaContratacao> {
      const { data } = await api.post("/assinaturas", params);
      return data;
    },
    async obterStatus(): Promise<StatusAssinatura> {
      const { data } = await api.get("/assinaturas/status");
      return data;
    },
    async upgrade(id: string, params: { planCode: string }): Promise<RespostaContratacao> {
      const { data } = await api.patch(`/assinaturas/${id}/upgrade`, params);
      return data;
    },
    async cancelarAssinatura(id: string) {
      const { data } = await api.delete(`/assinaturas/${id}`);
      return data;
    },
  };
}
