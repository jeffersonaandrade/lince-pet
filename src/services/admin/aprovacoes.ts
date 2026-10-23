import { api } from "@/hook/api";

export type CrmvPendente = {
  id: string;
  nome: string;
  email: string | null;
  crmv: string | null;
  uf: string | null;
  enviado_em: string | null;
};

export type RtPendente = {
  id: string;
  nome: string;
  email: string | null;
  cnpj: string | null;
  cidade: string | null;
  estado: string | null;
  rt_nome: string | null;
  rt_crmv: string | null;
  uf: string | null;
  enviado_em: string | null;
};

export type Decisao = { decisao: "aprovar" | "reprovar"; motivo?: string };

export const AprovacoesService = {
  async listar(): Promise<{ veterinarios: CrmvPendente[]; clinicas: RtPendente[] }> {
    return (await api.get("/admin/aprovacoes")).data;
  },
  async decidirCrmv(id: string, decisao: Decisao) {
    return (await api.post(`/admin/aprovacoes/veterinarios/${id}`, decisao)).data;
  },
  async decidirRt(id: string, decisao: Decisao) {
    return (await api.post(`/admin/aprovacoes/clinicas/${id}`, decisao)).data;
  },
};
