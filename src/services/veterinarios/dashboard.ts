import { api } from "@/hook/api";
import { formatEventTitle, formatDateToISO } from "@/utils/formatters";



export interface AgendamentoDashboard {
  id: number;
  cliente: string;
  clienteSobrenome?: string;
  tutorTelefone?: string | null;
  tutorEmail?: string | null;
  petId?: string | null;
  pet: string;
  petEspecie?: string;
  petRaca?: string;
  petPorte?: string;
  horario: string;
  tipo: string;
  data_consulta: string;
  status: string;
  observacoes?: string;
  localNome?: string;
  localEndereco?: string;
  valor?: number;
  petFotoUrl?: string;
}


export interface EstatisticasDashboard {
  agendamentosHoje: number;
  agendamentosSemana: number;
  agendamentosMes: number;
  totalClientes: number;
}

export interface EventoCalendario {
  id: number;
  title: string;
  start: Date;
  end: Date;
  resource: {
    cliente: string;
    tutorTelefone?: string | null;
    tutorEmail?: string | null;
    petId?: string | null;
    pet: string;
    tipo: string;
    status: string;
  };
}

/**
 * Service para gerenciar o dashboard do veterinário
 */
export class VeterinarioDashboardService {
  /**
   * Busca as estatísticas do dashboard
   */
  static async buscarEstatisticas(): Promise<EstatisticasDashboard> {
    try {
      console.log("📊 [Dashboard Service] Buscando estatísticas...");
      const response = await api.get("/veterinarios/dashboard/estatisticas");
      console.log(
        "✅ [Dashboard Service] Estatísticas recebidas:",
        response.data
      );
      return response.data;
    } catch (error: any) {
      console.error(
        "❌ [Dashboard Service] Erro ao buscar estatísticas:",
        error
      );
      console.error("❌ [Dashboard Service] Response:", error.response?.data);

      // Retorna valores padrão em caso de erro
      return {
        agendamentosHoje: 0,
        agendamentosSemana: 0,
        agendamentosMes: 0,
        totalClientes: 0,
      };
    }
  }

  /**
   * Busca os agendamentos do veterinário para o calendário
   * @param dataInicio Data de início no formato YYYY-MM-DD
   * @param dataFim Data de fim no formato YYYY-MM-DD
   */
  static async buscarAgendamentosCalendario(
    dataInicio: string,
    dataFim: string
  ): Promise<EventoCalendario[]> {
    try {
      console.log(
        "📅 [Dashboard Service] Buscando agendamentos do calendário..."
      );
      console.log(
        "📅 [Dashboard Service] Período:",
        dataInicio,
        "até",
        dataFim
      );

      const response = await api.get("/veterinarios/agendamentos", {
        params: {
          data_inicio: dataInicio,
          data_fim: dataFim,
        },
      });

      console.log(
        "✅ [Dashboard Service] Agendamentos recebidos:",
        response.data.agendamentos?.length || 0
      );

      // Se não houver agendamentos, retorna array vazio
      if (
        !response.data.agendamentos ||
        response.data.agendamentos.length === 0
      ) {
        console.log(
          "ℹ️ [Dashboard Service] Nenhum agendamento encontrado no período"
        );
        return [];
      }

      // Converte os agendamentos para o formato do calendário
      return response.data.agendamentos.map((agendamento: any) => {
        const [dia, mes, ano] = agendamento.data_consulta.split("/");
        const [hora, minuto] = agendamento.horario_consulta.split(":");

        const start = new Date(
          parseInt(ano),
          parseInt(mes) - 1,
          parseInt(dia),
          parseInt(hora),
          parseInt(minuto)
        );

        // Assume 1 hora de duração
        const end = new Date(start.getTime() + 60 * 60 * 1000);

        return {
          id: agendamento.id,
          title: formatEventTitle(
            agendamento.tutor_nome,
            agendamento.pet_nome || "Pet"
          ),
          start,
          end,
          resource: {
            cliente: agendamento.tutor_nome,
            petId: agendamento.pet_id ?? null,
            pet: agendamento.pet_nome || "Pet",
            tipo: agendamento.tipo_consulta,
            status: agendamento.status,
            localNome: agendamento.local_nome,
            localEndereco: agendamento.local_endereco,
            petFotoUrl: agendamento.pet_foto_url,
            clienteSobrenome: agendamento.tutor_sobrenome,
            tutorTelefone: agendamento.tutor_telefone,
            tutorEmail: agendamento.tutor_email,
            petRaca: agendamento.pet_raca,
            petPorte: agendamento.pet_porte,
            petEspecie: agendamento.pet_especie,
            observacoes: agendamento.observacoes,
            valor: agendamento.preco_consulta ? Number(agendamento.preco_consulta) : 0,

            horario: agendamento.horario_consulta,
          },
        };
      });
    } catch (error: any) {
      console.error(
        "❌ [Dashboard Service] Erro ao buscar agendamentos do calendário:",
        error
      );
      console.error("❌ [Dashboard Service] Response:", error.response?.data);
      return [];
    }
  }

  /**
   * Busca as próximas consultas do dia
   */
  static async buscarProximasConsultas(
    data?: string | Date
  ): Promise<AgendamentoDashboard[]> {
    try {
      console.log("🕐 [Dashboard Service] Buscando próximas consultas...");
      // Determina a data alvo (YYYY-MM-DD)
      let dataAlvoISO: string;
      if (data instanceof Date) {
        dataAlvoISO = formatDateToISO(data);
      } else if (typeof data === "string" && data.trim().length > 0) {
        // Espera-se formato YYYY-MM-DD
        dataAlvoISO = data;
      } else {
        const hoje = new Date();
        dataAlvoISO = formatDateToISO(hoje);
      }

      const response = await api.get("/veterinarios/agendamentos", {
        params: {
          data_inicio: dataAlvoISO,
          data_fim: dataAlvoISO,
          status: "confirmado,pendente,em andamento,realizado,cancelado",
        },
      });

      console.log(
        "✅ [Dashboard Service] Consultas do dia:",
        response.data.agendamentos?.length || 0
      );

      if (
        !response.data.agendamentos ||
        response.data.agendamentos.length === 0
      ) {
        console.log("ℹ️ [Dashboard Service] Nenhuma consulta para o dia");
        return [];
      }

      return response.data.agendamentos.map((agendamento: any) => ({
        id: agendamento.id,
        cliente: agendamento.tutor_nome,
        clienteSobrenome: agendamento.tutor_sobrenome,
        tutorTelefone: agendamento.tutor_telefone,
        tutorEmail: agendamento.tutor_email,
        petId: agendamento.pet_id ?? null,
        pet: agendamento.pet_nome || "Pet",
        petEspecie: agendamento.pet_especie,
        petRaca: agendamento.pet_raca,
        petPorte: agendamento.pet_porte,
        horario: agendamento.horario_consulta,
        tipo: agendamento.tipo_consulta,
        data_consulta: agendamento.data_consulta,
        status: agendamento.status,
        observacoes: agendamento.observacoes,
        localNome: agendamento.local_nome,
        localEndereco: agendamento.local_endereco,
        valor: agendamento.preco_consulta ? Number(agendamento.preco_consulta) : 0,

        petFotoUrl: agendamento.pet_foto_url,
      }));

    } catch (error: any) {
      console.error(
        "❌ [Dashboard Service] Erro ao buscar próximas consultas:",
        error
      );
      console.error("❌ [Dashboard Service] Response:", error.response?.data);
      return [];
    }
  }

  /**
   * Marca um agendamento como concluído (realizado)
   */
  static async concluirAgendamento(agendamentoId: number): Promise<boolean> {
    try {
      console.log(
        "✅ [Dashboard Service] Concluindo agendamento:",
        agendamentoId
      );
      await api.patch(`/veterinarios/agendamentos/${agendamentoId}/concluir`);
      return true;
    } catch (error: any) {
      console.error(
        "❌ [Dashboard Service] Erro ao concluir agendamento:",
        error
      );
      console.error("❌ [Dashboard Service] Response:", error.response?.data);
      return false;
    }
  }

  /**
   * Inicia um agendamento validando o código informado
   */
  static async iniciarAgendamento(
    agendamentoId: number,
    code: string
  ): Promise<{ ok: boolean; error?: string }> {
    try {
      await api.patch(`/veterinarios/agendamentos/${agendamentoId}/iniciar`, {
        code,
      });
      return { ok: true };
    } catch (error: any) {
      const msg = error?.response?.data?.message || "Falha ao iniciar consulta";
      console.error("❌ [Dashboard Service] Erro ao iniciar agendamento:", msg);
      return { ok: false, error: msg };
    }
  }
}
