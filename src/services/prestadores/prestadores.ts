import { api } from "@/hook/api";

export type Modalidade = "duracao" | "periodo";
export type TipoServico = { id: string; slug: string; nome: string; descricao: string | null; modalidade: Modalidade };
export type Servico = { id: string; nome: string; descricao: string | null; preco: number; duracao_min: number | null };
export type Grade = Record<string, [string, string]>;

export type PrestadorPublico = {
  id: string;
  nome: string;
  foto_url: string | null;
  bio: string | null;
  tipo_servico: TipoServico;
  cidade: string | null;
  estado: string | null;
  bairro: string | null;
  atende_domicilio: boolean;
  atende_local_proprio: boolean;
  raio_km: number | null;
  horarios: Grade;
  servicos: Servico[];
  preco_a_partir: number | null;
  nota_media: number | null;
  total_avaliacoes: number;
  limite_atingido?: boolean;
};

export type PerfilPrestador = {
  id: string;
  tipo_servico: TipoServico;
  onboarding_step: number;
  onboarding_complete: boolean;
  cpf: string | null;
  cnpj: string | null;
  bio: string | null;
  foto_url: string | null;
  atende_domicilio: boolean;
  atende_local_proprio: boolean;
  raio_km: number | null;
  horarios: Grade;
  subscription_plan_code: string;
  endereco: {
    cep: string | null;
    rua: string | null;
    numero: string | null;
    bairro: string | null;
    cidade: string | null;
    estado: string | null;
  };
  servicos: Servico[];
};

export type Pedido = {
  id: string;
  status: string;
  inicio_em: string | null;
  fim_em: string | null;
  data: string | null;
  horario: string | null;
  preco: number | null;
  observacoes: string | null;
  local_nome: string | null;
  local_endereco: string | null;
  motivo_cancelamento: string | null;
  started_at: string | null;
  ended_at: string | null;
  servico: { id: string; nome: string; duracao_min: number | null } | null;
  tipo_servico: { slug: string; nome: string; modalidade: Modalidade } | null;
  pet: { id: string; nome: string; especie: string | null; raca: string | null } | null;
  tutor?: { nome: string; celular: string | null } | null;
  prestador?: { id: string; nome: string; foto_url: string | null; celular: string | null } | null;
  start_code?: string | null;
};

export type Bloqueio = {
  id: string;
  data_inicio: string;
  data_fim: string | null;
  recorrente: boolean;
  dias_semana: number[];
  dia_inteiro: boolean;
  horarios: string[];
  motivo: string | null;
};

export type RegistroPrestador = {
  tipo_servico: string;
  email: string;
  password: string;
  nome: string;
  sobrenome: string;
  celular: string;
  cpf?: string;
  cnpj?: string;
};

export type NovoPedido = {
  pet_id: string;
  servico_id: string;
  data: string;
  horario: string;
  data_fim?: string | null;
  horario_fim?: string | null;
  local: "domicilio" | "local_proprio";
  observacoes?: string | null;
};

export const PrestadoresService = {
  async tiposServico(): Promise<TipoServico[]> {
    return (await api.get("/tipos-servico")).data.data;
  },

  async registrar(data: RegistroPrestador) {
    return (await api.post("/prestadores/register", data)).data;
  },

  async perfil(): Promise<PerfilPrestador> {
    return (await api.get("/prestadores/perfil")).data.data;
  },

  async salvarEndereco(data: {
    cep: string;
    rua: string;
    numero: string;
    bairro?: string;
    cidade: string;
    estado: string;
    atende_domicilio: boolean;
    atende_local_proprio: boolean;
    raio_km?: number | null;
  }) {
    return (await api.post("/prestadores/onboarding/passo1", data)).data;
  },

  async salvarServicos(servicos: Omit<Servico, "id">[]) {
    return (await api.post("/prestadores/onboarding/servicos", { servicos })).data;
  },

  async salvarApresentacao(data: { bio: string; horarios: Grade; foto?: File | null }) {
    if (!data.foto) return (await api.post("/prestadores/onboarding/passo3", { bio: data.bio, horarios: data.horarios })).data;
    const form = new FormData();
    form.append("bio", data.bio);
    form.append("horarios", JSON.stringify(data.horarios));
    form.append("foto", data.foto);
    const res = await api.post("/prestadores/onboarding/passo3", form, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return res.data;
  },

  async buscar(params: { tipo?: string; cidade?: string; estado?: string; search?: string }): Promise<PrestadorPublico[]> {
    return (await api.get("/prestadores/search", { params })).data.data;
  },

  async obter(id: string): Promise<PrestadorPublico> {
    return (await api.get(`/prestadores/${id}`)).data.data;
  },

  async disponibilidade(id: string, servicoId: string, data: string) {
    const res = await api.get(`/prestadores/${id}/disponibilidade`, { params: { servico_id: servicoId, data } });
    return res.data.data as { data: string; modalidade: Modalidade; faixa: [string, string] | null; horarios: string[] };
  },

  async pedir(id: string, data: NovoPedido): Promise<Pedido> {
    return (await api.post(`/prestadores/${id}/pedidos`, data)).data.data;
  },

  async pedidosRecebidos(status?: string): Promise<Pedido[]> {
    return (await api.get("/prestadores/pedidos", { params: status ? { status } : {} })).data.data;
  },

  async aceitar(id: string): Promise<Pedido> {
    return (await api.patch(`/prestadores/pedidos/${id}/aceitar`)).data.data;
  },

  async recusar(id: string, motivo?: string): Promise<Pedido> {
    return (await api.patch(`/prestadores/pedidos/${id}/recusar`, { motivo })).data.data;
  },

  async iniciar(id: string, code: string): Promise<Pedido> {
    return (await api.patch(`/prestadores/pedidos/${id}/iniciar`, { code })).data.data;
  },

  async concluir(id: string): Promise<Pedido> {
    return (await api.patch(`/prestadores/pedidos/${id}/concluir`)).data.data;
  },

  async bloqueios(): Promise<Bloqueio[]> {
    return (await api.get("/prestadores/bloqueios")).data.data;
  },

  async bloquear(data: {
    data_inicio: string;
    data_fim?: string | null;
    horarios?: string[] | null;
    motivo?: string | null;
  }): Promise<Bloqueio> {
    return (await api.post("/prestadores/bloqueios", data)).data.data;
  },

  async removerBloqueio(id: string) {
    await api.delete(`/prestadores/bloqueios/${id}`);
  },

  async meusPedidos(): Promise<Pedido[]> {
    return (await api.get("/tutor/pedidos")).data.data;
  },

  async cancelarPedido(id: string, motivo?: string) {
    return (await api.patch(`/agendamentos/${id}/cancelar`, { motivo })).data;
  },

  async remarcarPedido(id: string, data: { data: string; horario: string; data_fim?: string | null; horario_fim?: string | null }) {
    return (await api.patch(`/agendamentos/${id}/reagendar`, data)).data;
  },
};
