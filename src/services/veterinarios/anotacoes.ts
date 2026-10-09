import { api } from "@/hook/api";

export type StatusPagamento = "pago" | "pendente" | "isento";
export type FormaPagamento = "pix" | "cartao" | "dinheiro" | "plano_pet" | "outro";

export interface AnotacaoPrivada {
  id: string;
  agendamento_id: string;
  local_atendimento: string | null;
  status_pagamento: StatusPagamento | null;
  forma_pagamento: FormaPagamento | null;
  plano_nome: string | null;
  observacoes: string | null;
  updated_at: string | null;
}

export interface AnotacaoPayload {
  local_atendimento: string | null;
  status_pagamento: StatusPagamento | null;
  forma_pagamento: FormaPagamento | null;
  plano_nome: string | null;
  observacoes: string | null;
}

export interface AnotacaoHistorico extends AnotacaoPrivada {
  data_consulta: string | null;
  horario_consulta: string | null;
  status_consulta: string;
  tipo_consulta: string | null;
}

export const MAX_OBSERVACOES = 5000;

export const AnotacoesService = {
  async obter(agendamentoId: string | number): Promise<AnotacaoPrivada | null> {
    const response = await api.get(`/veterinarios/agendamentos/${agendamentoId}/anotacao`);
    return response.data?.anotacao ?? null;
  },

  /** Anotações do próprio vet em outras consultas do mesmo pet (mais recentes primeiro). */
  async historico(agendamentoId: string | number): Promise<AnotacaoHistorico[]> {
    const response = await api.get(`/veterinarios/agendamentos/${agendamentoId}/anotacao/historico`);
    return response.data?.data || [];
  },

  async salvar(agendamentoId: string | number, payload: AnotacaoPayload): Promise<AnotacaoPrivada> {
    const response = await api.put(`/veterinarios/agendamentos/${agendamentoId}/anotacao`, payload);
    return response.data.anotacao;
  },
};
