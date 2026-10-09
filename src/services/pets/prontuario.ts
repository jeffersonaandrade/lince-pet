import { api } from "@/hook/api";
import type { Encaminhamento } from "@/services/encaminhamentos/encaminhamentos";

export interface RegistroClinico {
  id: string;
  agendamento_id: string;
  queixa: string | null;
  diagnostico: string | null;
  tratamento: string | null;
  peso_kg: number | null;
  vacinas_medicacoes: string | null;
  retorno_sugerido: string | null;
  plano_saude: string | null;
  encaminhamento: string | null;
  updated_at: string | null;
}

export type RegistroClinicoPayload = Omit<RegistroClinico, "id" | "agendamento_id" | "updated_at">;

export interface ConsultaProntuario {
  agendamento_id: string;
  data_consulta: string | null;
  horario_consulta: string | null;
  tipo_consulta: string | null;
  status: string;
  local_nome: string | null;
  veterinario_nome: string | null;
  clinica_nome: string | null;
  registro: RegistroClinico | null;
}

export interface Prontuario {
  pet: {
    id: string;
    nome: string;
    especie: string;
    raca: string | null;
    idade: number | null;
    porte: string | null;
    foto_url: string | null;
  };
  consultas: ConsultaProntuario[];
  encaminhamentos?: Encaminhamento[];
}

export const MAX_TEXTO_REGISTRO = 5000;
export const PESO_MAXIMO_KG = 500;

export const ProntuarioService = {
  /** Prontuário completo do pet (tutor dono, vets e clínicas que atendem o pet). */
  async obter(petId: string): Promise<Prontuario> {
    const response = await api.get(`/pets/${petId}/prontuario`);
    return response.data;
  },

  async obterRegistro(agendamentoId: string | number): Promise<RegistroClinico | null> {
    const response = await api.get(`/veterinarios/agendamentos/${agendamentoId}/registro`);
    return response.data?.registro ?? null;
  },

  async salvarRegistro(agendamentoId: string | number, payload: RegistroClinicoPayload): Promise<RegistroClinico> {
    const response = await api.put(`/veterinarios/agendamentos/${agendamentoId}/registro`, payload);
    return response.data.registro;
  },
};
