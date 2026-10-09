import { api } from "@/hook/api";



export type CriarAvaliacaoPayload = {
  estrelas: number; // 1..5
  comentario?: string;
  estrelasClinica?: number;
  comentarioClinica?: string;
};

export class AvaliacoesService {
  static async criarAvaliacao(
    agendamentoId: string,
    payload: CriarAvaliacaoPayload
  ): Promise<{ id: string; estrelas: number; comentario?: string | null; estrelasClinica?: number | null; comentarioClinica?: string | null }> {
    try {
      const res = await api.post(
        `/agendamentos/${agendamentoId}/avaliacao`,
        payload
      );
      return res.data.avaliacao;
    } catch (error: any) {
      const status = error?.response?.status;
      const message = error?.response?.data?.message;
      if (status === 400)
        throw new Error(message || "Não foi possível registrar a avaliação.");
      if (status === 401)
        throw new Error("Faça login como tutor para avaliar.");
      if (status === 404) throw new Error("Agendamento não encontrado.");
      throw new Error("Erro ao enviar avaliação. Tente novamente.");
    }
  }

  static async listarPorVeterinario(veterinarioId: string): Promise<{
    media: number;
    total: number;
    avaliacoes: Array<{
      id: string;
      estrelas: number;
      comentario?: string | null;
      data?: string | null;
      hora?: string | null;
      tutor?: { nome: string; sobrenome?: string | null } | null;
    }>;
  }> {
    const res = await api.get(`/veterinarios/${veterinarioId}/avaliacoes`);
    return res.data;
  }

  static async mediaVeterinario(
    veterinarioId: string
  ): Promise<{ media: number; total: number }> {
    const res = await api.get(`/veterinarios/${veterinarioId}/nota-media`);
    return res.data;
  }

  // Avaliações do veterinário autenticado (dashboard)
  static async listarMinhasRecentes(): Promise<{
    avaliacoes: Array<{
      id: string;
      estrelas: number;
      comentario?: string | null;
      data?: string | null;
      hora?: string | null;
      tutor?: { nome: string; sobrenome?: string | null } | null;
      pet?: { nome: string; foto_url?: string | null } | null;
    }>;
  }> {
    const res = await api.get(`/veterinarios/avaliacoes-recentes`);
    return res.data;
  }

  static async listarPorClinica(clinicaId: string): Promise<{
    media: number;
    total: number;
    avaliacoes: Array<{
      id: string;
      estrelasClinica: number;
      comentarioClinica?: string | null;
      data?: string | null;
      hora?: string | null;
      tutor?: { nome: string; sobrenome?: string | null } | null;
    }>;
  }> {
    const res = await api.get(`/clinicas/${clinicaId}/avaliacoes`);
    return res.data;
  }

  static async mediaClinica(
    clinicaId: string
  ): Promise<{ media: number; total: number }> {
    const res = await api.get(`/clinicas/${clinicaId}/nota-media`);
    return res.data;
  }

  // Avaliações da clinica autenticada (dashboard)
  static async listarMinhasRecentesClinica(): Promise<{
    avaliacoes: Array<{
      id: string;
      estrelasClinica: number;
      comentarioClinica?: string | null;
      data?: string | null;
      hora?: string | null;
      tutor?: { nome: string; sobrenome?: string | null } | null;
      pet?: { nome: string; foto_url?: string | null } | null;
    }>;
  }> {
    const res = await api.get(`/clinicas/avaliacoes-recentes`);
    return res.data;
  }
}
