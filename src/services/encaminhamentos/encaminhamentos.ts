import { api } from "@/hook/api";
import { searchVeterinarios } from "@/services/veterinarios/veterinarios";
import { searchClinicas } from "@/services/clinicas/clinicas";
import { PrestadoresService } from "@/services/prestadores/prestadores";

export type DestinoTipo = "veterinario" | "clinica" | "prestador";
export type StatusEncaminhamento = "enviado" | "aceito" | "recusado";
export type Urgencia = "rotina" | "prioritario";

export type Encaminhamento = {
  id: string;
  status: StatusEncaminhamento;
  urgencia: Urgencia;
  motivo: string;
  motivo_recusa: string | null;
  criado_em: string | null;
  respondido_em: string | null;
  pet: { id: string; nome: string; especie: string | null; raca: string | null } | null;
  tutor: { nome: string } | null;
  origem: {
    nome: string;
    veterinario_nome: string | null;
    clinica_nome: string | null;
    agendamento_id: string;
    data_consulta: string | null;
  };
  destino: {
    tipo: DestinoTipo;
    id: string | null;
    nome: string;
    rotulo: string;
    foto_url: string | null;
    link: string;
  };
  agendamento_destino: { id: string; status: string; data: string | null; horario: string | null } | null;
};

export type DestinoOpcao = { id: string; nome: string; detalhe: string };

export const ROTULO_STATUS: Record<StatusEncaminhamento, string> = {
  enviado: "Enviado",
  aceito: "Aceito",
  recusado: "Recusado",
};

export const ROTULO_DESTINO: Record<DestinoTipo, string> = {
  veterinario: "Veterinário especialista",
  clinica: "Clínica",
  prestador: "Profissional pet",
};

/** Link de agendamento no destino, já com o encaminhamento e o pet. */
export const linkAgendar = (e: Encaminhamento) =>
  `${e.destino.link}?encaminhamento=${e.id}${e.pet ? `&pet=${e.pet.id}` : ""}`;

const local = (cidade?: string | null, estado?: string | null) => [cidade, estado].filter(Boolean).join(" - ");

export const EncaminhamentosService = {
  async enviar(
    agendamentoId: string | number,
    data: { destino_tipo: DestinoTipo; destino_id: string; motivo: string; urgencia: Urgencia }
  ): Promise<Encaminhamento> {
    return (await api.post(`/agendamentos/${agendamentoId}/encaminhamentos`, data)).data.data;
  },

  async daConsulta(agendamentoId: string | number): Promise<Encaminhamento[]> {
    return (await api.get(`/agendamentos/${agendamentoId}/encaminhamentos`)).data.data;
  },

  async recebidos(): Promise<Encaminhamento[]> {
    return (await api.get("/encaminhamentos/recebidos")).data.data;
  },

  async aceitar(id: string): Promise<Encaminhamento> {
    return (await api.post(`/encaminhamentos/${id}/aceitar`)).data.data;
  },

  async recusar(id: string, motivo: string): Promise<Encaminhamento> {
    return (await api.post(`/encaminhamentos/${id}/recusar`, { motivo })).data.data;
  },

  async doTutor(): Promise<Encaminhamento[]> {
    return (await api.get("/tutor/encaminhamentos")).data.data;
  },

  async obter(id: string): Promise<Encaminhamento | null> {
    const lista = await EncaminhamentosService.doTutor();
    return lista.find((e) => e.id === id) ?? null;
  },

  /** Busca destinos reaproveitando as buscas públicas de veterinário, clínica e prestador. */
  async buscarDestinos(tipo: DestinoTipo, termo: string): Promise<DestinoOpcao[]> {
    const search = termo.trim() || undefined;
    if (tipo === "veterinario") {
      const res = await searchVeterinarios({ search });
      return (res.veterinarios || []).map((v: { id: string; nome: string; especialidades?: string[]; cidade?: string; estado?: string }) => ({
        id: String(v.id),
        nome: v.nome,
        detalhe: [(v.especialidades || []).slice(0, 3).join(", "), local(v.cidade, v.estado)].filter(Boolean).join(" · "),
      }));
    }
    if (tipo === "clinica") {
      const res = await searchClinicas(search ? { search } : {});
      const lista = Array.isArray(res) ? res : res.clinicas || [];
      return lista.map((c: { id: string; nomeClinica: string; cidade?: string; estado?: string }) => ({
        id: String(c.id),
        nome: c.nomeClinica,
        detalhe: local(c.cidade, c.estado),
      }));
    }
    const lista = await PrestadoresService.buscar({ search });
    return lista.map((p) => ({ id: p.id, nome: p.nome, detalhe: [p.tipo_servico.nome, local(p.cidade, p.estado)].filter(Boolean).join(" · ") }));
  },
};
