import { api } from "@/hook/api";
import type { StatusAnalise } from "@/contexts/AuthContext";

export type Exame = {
  id: string;
  nome: string;
  descricao: string | null;
  preparo: string | null;
  preco: number;
  duracao_min: number;
  capacidade: number;
  ativo: boolean;
};

export type Combo = {
  id: string;
  nome: string;
  descricao: string | null;
  preco: number;
  preco_avulso: number;
  duracao_min: number;
  ativo: boolean;
  disponivel: boolean;
  exames: { id: string; nome: string; preparo: string | null }[];
};

export type ResponsavelTecnico = {
  rt_nome: string | null;
  rt_crmv: string | null;
  rt_status: StatusAnalise | null;
  rt_motivo: string | null;
};

export type PainelExames = {
  exames_ativo: boolean;
  plano_com_exames: boolean;
  visivel: boolean;
  uso_mes: { usados: number; limite: number | null };
  rt: ResponsavelTecnico;
  exames: Exame[];
  combos: Combo[];
};

export type ExameInput = {
  nome: string;
  descricao?: string | null;
  preparo?: string | null;
  preco: number;
  duracao_min: number;
  capacidade: number;
  ativo?: boolean;
};

export type ComboInput = { nome: string; descricao?: string | null; preco: number; exame_ids: string[]; ativo?: boolean };

export type OfertaExames = {
  clinica: {
    id: string;
    nome: string;
    endereco: string | null;
    cidade: string | null;
    estado: string | null;
    foto: string | null;
    telefone: string | null;
  };
  exames: Exame[];
  combos: Combo[];
};

export type AgendamentoExame = {
  id: string;
  status: string;
  data: string | null;
  horario: string | null;
  inicio_em: string | null;
  fim_em: string | null;
  preco: number;
  observacoes: string | null;
  motivo_cancelamento: string | null;
  clinica: { id: string; nome: string; endereco: string | null } | null;
  pet: { id: string; nome: string; especie: string | null; raca: string | null } | null;
  tutor: { nome: string; celular: string | null; email: string } | null;
  exames: { nome: string; preparo: string | null; combo: boolean }[];
  laudo: { nome_arquivo: string | null; enviado_em: string | null } | null;
};

export type Escolha = { exame_ids?: string[]; combo_id?: string | null };

export type Disponibilidade = { data: string; duracao_min: number; preco: number; horarios: string[] };

export const formatarPreco = (valor: number) =>
  valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export const formatarDuracao = (min: number) =>
  min < 60 ? `${min} min` : `${Math.floor(min / 60)}h${min % 60 ? ` ${min % 60}min` : ""}`;

/** Painel da clínica. */
export const ExamesClinicaService = {
  async painel(): Promise<PainelExames> {
    return (await api.get("/clinicas/exames")).data;
  },
  async alternarModulo(ativo: boolean): Promise<PainelExames> {
    return (await api.patch("/clinicas/exames", { ativo })).data;
  },
  async criarExame(dados: ExameInput): Promise<Exame> {
    return (await api.post("/clinicas/exames/itens", dados)).data;
  },
  async atualizarExame(id: string, dados: ExameInput): Promise<Exame> {
    return (await api.put(`/clinicas/exames/itens/${id}`, dados)).data;
  },
  async removerExame(id: string): Promise<{ removido: boolean; desativado: boolean }> {
    return (await api.delete(`/clinicas/exames/itens/${id}`)).data;
  },
  async criarCombo(dados: ComboInput): Promise<Combo> {
    return (await api.post("/clinicas/exames/combos", dados)).data;
  },
  async atualizarCombo(id: string, dados: ComboInput): Promise<Combo> {
    return (await api.put(`/clinicas/exames/combos/${id}`, dados)).data;
  },
  async removerCombo(id: string) {
    return (await api.delete(`/clinicas/exames/combos/${id}`)).data;
  },
  async salvarRt(dados: { rt_nome: string; rt_crmv: string }): Promise<ResponsavelTecnico> {
    return (await api.put("/clinicas/responsavel-tecnico", dados)).data;
  },
  async agenda(filtros: { de?: string; ate?: string; status?: string } = {}): Promise<AgendamentoExame[]> {
    return (await api.get("/clinicas/exames/agenda", { params: filtros })).data.agendamentos;
  },
  async marcarRealizado(id: string) {
    return (await api.patch(`/clinicas/exames/agenda/${id}`, { acao: "realizado" })).data;
  },
  async cancelar(id: string, motivo: string) {
    return (await api.patch(`/clinicas/exames/agenda/${id}`, { acao: "cancelar", motivo })).data;
  },
  async enviarLaudo(id: string, arquivo: File) {
    const form = new FormData();
    form.append("laudo", arquivo);
    return (await api.post(`/clinicas/exames/agenda/${id}/laudo`, form)).data;
  },
};

/** Busca, perfil público e agendamento pelo tutor. */
export const ExamesService = {
  async buscar(filtros: { search?: string; cidade?: string }): Promise<OfertaExames[]> {
    return (await api.get("/exames", { params: filtros })).data.clinicas;
  },
  async daClinica(clinicaId: string): Promise<OfertaExames | null> {
    return (await api.get(`/exames/clinicas/${clinicaId}`)).data.oferta;
  },
  async disponibilidade(clinicaId: string, escolha: Escolha, data: string): Promise<Disponibilidade> {
    const params = {
      data,
      ...(escolha.combo_id ? { combo_id: escolha.combo_id } : { exame_ids: (escolha.exame_ids ?? []).join(",") }),
    };
    return (await api.get(`/exames/clinicas/${clinicaId}/disponibilidade`, { params })).data;
  },
  async agendar(
    clinicaId: string,
    dados: Escolha & { pet_id: string; data: string; horario: string; observacoes?: string; encaminhamento_id?: string | null }
  ): Promise<AgendamentoExame> {
    return (await api.post(`/exames/clinicas/${clinicaId}/agendar`, dados)).data.agendamento;
  },
  async disponibilidadeParaRemarcar(agendamentoId: string, data: string): Promise<Omit<Disponibilidade, "preco">> {
    return (await api.get(`/exames/agendamentos/${agendamentoId}/disponibilidade`, { params: { data } })).data;
  },
  async remarcar(agendamentoId: string, data: string, horario: string) {
    return (await api.patch(`/agendamentos/${agendamentoId}/reagendar`, { data, horario })).data;
  },
  /** URL assinada e curta do laudo em PDF. */
  async urlDoLaudo(agendamentoId: string): Promise<string> {
    return (await api.get(`/exames/agendamentos/${agendamentoId}/laudo`)).data.url;
  },
};
