import { api } from "@/hook/api";

export type BillingType = "PIX" | "BOLETO" | "CREDIT_CARD";

export function AssinaturasService() {
  

  return {
    async listarPlanos() {
      const { data } = await api.get("/assinaturas/planos");
      return data?.plans || [];
    },
    async criarAssinatura(params: {
      planCode: string;
      billingType?: BillingType;
      creditCardToken?: string;
      cycle?: "MONTHLY" | "QUARTERLY" | "SEMIANNUALLY" | "YEARLY";
    }) {
      const { data } = await api.post("/assinaturas", params);
      return data;
    },
    async obterStatus() {
      const { data } = await api.get("/assinaturas/status");
      return data;
    },
    async upgrade(id: string, params: { planCode: string; cycle?: string; billingType?: BillingType; creditCardToken?: string }) {
      const { data } = await api.patch(`/assinaturas/${id}/upgrade`, params);
      return data;
    },
    async obterAssinatura(id: string) {
      const { data } = await api.get(`/assinaturas/${id}`);
      return data?.subscription;
    },
    async cancelarAssinatura(id: string) {
      const { data } = await api.delete(`/assinaturas/${id}`);
      return data?.result;
    },
  };
}
