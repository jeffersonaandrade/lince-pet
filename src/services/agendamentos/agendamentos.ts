import { api } from "@/hook/api";

// Create a function to get API instance


export interface AgendamentoData {
  veterinario_id: string;
  data_consulta: string; // formato YYYY-MM-DD
  horario_consulta: string; // formato HH:mm
  tipo_consulta: "presencial" | "online" | "domicilio";
  pet_id: string; // novo: pet que irá à consulta
  observacoes?: string;
  clinica_id?: string;
}

export interface AgendamentoResponse {
  id: string;
  data_consulta: string;
  horario_consulta: string;
  tipo_consulta: string;
  status: "pendente" | "confirmado" | "realizado" | "cancelado";
  preco_consulta: number;
  observacoes?: string;
  localNome?: string;
  localEndereco?: string;
  veterinario: {
    nome: string;
    crmv: string;
  };
  tutor: {
    nome: string;
  };
}

export interface ListaAgendamentosResponse {
  agendamentos: {
    id: string;
    data_consulta: string;
    horario_consulta: string;
    tipo_consulta: string;
    status: string;
    preco_consulta: number;
    observacoes?: string;
    pode_cancelar: boolean;
    ja_passou: boolean;
    avaliado?: boolean;
    veterinario: {
      id: string;
      nome: string;
      crmv: string;
      bio?: string;
      foto_url?: string;
    };

    pet?: {
      nome: string;
    };
    created_at: string;
  }[];
}

export interface DisponibilidadeResponse {
  data: string;
  /** Inclui horários com consulta e horários bloqueados pelo profissional. */
  horarios_ocupados: string[];
  horarios_bloqueados?: string[];
  dia_bloqueado?: boolean;
}

/**
 * Service para gerenciar agendamentos
 * Centraliza toda a comunicação com a API relacionada a agendamentos
 */
export class AgendamentosService {
  /**
   * Cria um novo agendamento
   * @param dadosAgendamento Dados do agendamento a ser criado
   * @returns Promise com os dados do agendamento criado
   */
  static async criarAgendamento(
    dadosAgendamento: AgendamentoData
  ): Promise<AgendamentoResponse> {
    try {
      console.log(
        "[AgendamentosService] Criando agendamento:",
        dadosAgendamento
      );

      const response = await api.post("/agendamentos", dadosAgendamento);

      console.log(
        "[AgendamentosService] Agendamento criado com sucesso:",
        response.data
      );

      // A API retorna { message: string, agendamento: AgendamentoResponse }
      return response.data.agendamento;
    } catch (error) {
      console.error("[AgendamentosService] Erro ao criar agendamento:", error);

      // Trata erros específicos da API
      const axiosError = error as {
        response?: { status?: number; data?: { message?: string } };
      };
      if (axiosError.response?.status === 400) {
        throw new Error(
          axiosError.response.data?.message || "Dados do agendamento inválidos"
        );
      } else if (axiosError.response?.status === 401) {
        throw new Error("Você precisa estar logado para agendar uma consulta");
      } else if (axiosError.response?.status === 404) {
        throw new Error("Veterinário não encontrado");
      } else if (axiosError.response?.status === 409) {
        // Conflict - horário já ocupado
        throw new Error(
          "Este horário já foi ocupado. Por favor, escolha outro."
        );
      }

      throw new Error("Erro interno. Tente novamente em alguns instantes.");
    }
  }

  /**
   * Lista os agendamentos do usuário logado
   * @param filtros Filtros opcionais para a busca
   * @returns Promise com a lista de agendamentos
   */
  static async listarAgendamentos(filtros?: {
    status?: "pendente" | "confirmado" | "realizado" | "cancelado";
    data_inicio?: string;
    data_fim?: string;
  }): Promise<ListaAgendamentosResponse> {
    try {
      console.log(
        "[AgendamentosService] Listando agendamentos com filtros:",
        filtros
      );

      const params = new URLSearchParams();
      if (filtros?.status) params.append("status", filtros.status);
      if (filtros?.data_inicio)
        params.append("data_inicio", filtros.data_inicio);
      if (filtros?.data_fim) params.append("data_fim", filtros.data_fim);

      const queryString = params.toString();
      const url = `/agendamentos${queryString ? `?${queryString}` : ""}`;

      const response = await api.get(url);

      console.log("[AgendamentosService] Agendamentos obtidos:", response.data);

      return response.data;
    } catch (error) {
      console.error(
        "[AgendamentosService] Erro ao listar agendamentos:",
        error
      );

      const axiosError = error as { response?: { status?: number } };
      if (axiosError.response?.status === 401) {
        throw new Error("Sessão expirada. Faça login novamente.");
      }

      throw new Error("Erro ao carregar agendamentos. Tente novamente.");
    }
  }

  /**
   * Cancela um agendamento específico
   * @param agendamentoId ID do agendamento a ser cancelado
   * @param motivo Motivo do cancelamento (opcional)
   * @returns Promise com confirmação do cancelamento
   */
  static async cancelarAgendamento(
    agendamentoId: string,
    motivo?: string
  ): Promise<void> {
    try {
      console.log(
        "[AgendamentosService] Cancelando agendamento:",
        agendamentoId,
        "motivo:",
        motivo
      );

      await api.patch(`/agendamentos/${agendamentoId}/cancelar`, {
        motivo: motivo || "Cancelado pelo usuário",
      });

      console.log("[AgendamentosService] Agendamento cancelado com sucesso");
    } catch (error) {
      console.error(
        "[AgendamentosService] Erro ao cancelar agendamento:",
        error
      );

      const axiosError = error as {
        response?: { status?: number; data?: { message?: string } };
      };
      if (axiosError.response?.status === 400) {
        throw new Error(
          axiosError.response.data?.message ||
          "Este agendamento não pode ser cancelado"
        );
      } else if (axiosError.response?.status === 404) {
        throw new Error("Agendamento não encontrado");
      } else if (axiosError.response?.status === 401) {
        throw new Error(
          "Você não tem permissão para cancelar este agendamento"
        );
      }

      throw new Error("Erro ao cancelar agendamento. Tente novamente.");
    }
  }

  /**
   * Reagenda um agendamento específico
   * @param agendamentoId ID do agendamento a ser reagendado
   * @param novaData Nova data para a consulta (YYYY-MM-DD)
   * @param novoHorario Novo horário para a consulta (HH:mm)
   * @returns Promise com confirmação do reagendamento
   */
  static async reagendarAgendamento(
    agendamentoId: string,
    novaData: string,
    novoHorario: string
  ): Promise<any> {
    try {
      console.log(
        "[AgendamentosService] Reagendando agendamento:",
        agendamentoId,
        novaData,
        novoHorario
      );

      const response = await api.patch(`/agendamentos/${agendamentoId}/reagendar`, {
        data_consulta: novaData,
        horario_consulta: novoHorario,
      });

      console.log("[AgendamentosService] Agendamento reagendado com sucesso");
      return response.data;
    } catch (error) {
      console.error(
        "[AgendamentosService] Erro ao reagendar agendamento:",
        error
      );

      const axiosError = error as {
        response?: { status?: number; data?: { message?: string } };
      };
      if (axiosError.response?.status === 400) {
        throw new Error(
          axiosError.response.data?.message ||
          "Não foi possível reagendar este agendamento"
        );
      } else if (axiosError.response?.status === 404) {
        throw new Error("Agendamento não encontrado");
      } else if (axiosError.response?.status === 401) {
        throw new Error(
          "Você não tem permissão para reagendar este agendamento"
        );
      }

      throw new Error("Erro ao reagendar agendamento. Tente novamente.");
    }
  }

  /**
   * Verifica a disponibilidade de horários de um veterinário em uma data específica
   * @param veterinarioId ID do veterinário
   * @param data Data no formato YYYY-MM-DD
   * @returns Promise com os horários ocupados
   */
  static async verificarDisponibilidade(
    veterinarioId: string,
    data: string
  ): Promise<DisponibilidadeResponse> {
    try {
      console.log(
        "[AgendamentosService] Verificando disponibilidade:",
        veterinarioId,
        data
      );

      const response = await api.get(
        `/agendamentos/disponibilidade/${veterinarioId}?data=${data}`
      );

      console.log(
        "[AgendamentosService] Disponibilidade obtida:",
        response.data
      );

      return response.data;
    } catch (error) {
      console.error(
        "[AgendamentosService] Erro ao verificar disponibilidade:",
        error
      );

      // Em caso de erro, retorna array vazio (assume que todos os horários estão livres)
      return {
        data,
        horarios_ocupados: [],
      };
    }
  }

  /**
   * Filtra horários disponíveis removendo os já ocupados
   * @param todosHorarios Array com todos os horários possíveis
   * @param horariosOcupados Array com horários já ocupados
   * @returns Array apenas com horários disponíveis
   */
  static filtrarHorariosDisponiveis(
    todosHorarios: string[],
    horariosOcupados: string[]
  ): string[] {
    return todosHorarios.filter(
      (horario) => !horariosOcupados.includes(horario)
    );
  }

  /**
   * Valida se uma data é válida para agendamento
   * @param data Data no formato YYYY-MM-DD
   * @returns true se a data é válida, false caso contrário
   */
  static validarDataAgendamento(data: string): boolean {
    const dataAgendamento = new Date(data + "T00:00:00");
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0); // Remove a parte do horário para comparar apenas a data

    // Não permite agendar em datas passadas
    return dataAgendamento >= hoje;
  }

  /**
   * Formata uma data para o padrão brasileiro (DD/MM/AAAA)
   * @param data Data no formato YYYY-MM-DD
   * @returns Data formatada como DD/MM/AAAA
   */
  static formatarDataBrasil(data: string): string {
    const [ano, mes, dia] = data.split("-");
    return `${dia}/${mes}/${ano}`;
  }
}
