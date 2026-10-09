import { api } from "@/hook/api";
import { formatEventTitle, formatDateToISO } from "@/utils/formatters";



export interface AgendamentoDashboard {
  id: number | string;
  cliente: string;
  clienteSobrenome?: string;
  tutorTelefone?: string | null;
  tutorEmail?: string | null;
  petId?: string | null;
  pet: string;
  petRaca?: string;
  petPorte?: string;
  petEspecie?: string;
  petFotoUrl?: string | null;
  veterinario?: string;
  veterinarioSobrenome?: string;
  horario: string;
  tipo: string;
  data_consulta: string;
  status: string;
  observacoes?: string;
  valor?: number;
}

export interface EstatisticasDashboard {
  agendamentosHoje: number;
  agendamentosSemana: number;
  agendamentosMes: number;
  totalClientes: number;
}

export interface Profissional {
  id: string;
  nome: string;
  sobrenome: string;
  email: string;
  fotoUrl: string | null;
  crmv?: string;
  // Add other relevant fields
}

export interface EventoCalendario {
  id: number | string;
  title: string;
  start: Date;
  end: Date;
  resource: {
    cliente: string;
    clienteSobrenome?: string;
    tutorTelefone?: string | null;
    tutorEmail?: string | null;
    petId?: string | null;
    pet: string;
    petRaca?: string;
    petPorte?: string;
    petEspecie?: string;
    petFotoUrl?: string | null;
    veterinario?: string;
    veterinarioSobrenome?: string;
    tipo: string;
    status: string;
    observacoes?: string;
    valor?: number;
    horario?: string;
  };
}

/**
 * Service para gerenciar o dashboard da clínica
 */
export class ClinicaDashboardService {
  /**
   * Busca as estatísticas do dashboard
   */
  static async buscarEstatisticas(): Promise<EstatisticasDashboard> {
    try {
      console.log("📊 [Dashboard Service] Buscando estatísticas...");
      const response = await api.get("/clinicas/dashboard/estatisticas");
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

      return {
        agendamentosHoje: 0,
        agendamentosSemana: 0,
        agendamentosMes: 0,
        totalClientes: 0,
      };
    }
  }

  static async buscarProfissionais(): Promise<Profissional[]> {
    try {
      console.log("👨‍⚕️ [Dashboard Service] Buscando profissionais...");
      const response = await api.get("/clinicas/professionals");
      const rawPros = response.data.profissionais || [];
      return rawPros.map((v: any) => ({
        id: v.id,
        nome: v.user?.nome || "V",
        sobrenome: v.user?.sobrenome || "",
        email: v.user?.email || "",
        fotoUrl: v.fotoUrl,
        crmv: v.crmv
      }));
    } catch (error: any) {
      console.error("❌ [Dashboard Service] Erro ao buscar profissionais:", error);
      return [];
    }
  }

  /**
   * Busca os agendamentos da clínica para o calendário
   */
  static async buscarAgendamentosCalendario(
    dataInicio: string,
    dataFim: string
  ): Promise<EventoCalendario[]> {
    try {
      console.log(
        "📅 [Dashboard Service] Buscando agendamentos do calendário..."
      );

      const response = await api.get("/clinicas/agendamentos", {
        params: {
          data_inicio: dataInicio,
          data_fim: dataFim,
        },
      });

      if (
        !response.data.agendamentos ||
        response.data.agendamentos.length === 0
      ) {
        return [];
      }

      return response.data.agendamentos.map((agendamento: any) => {
        const [dia, mes, ano] = agendamento.data_consulta.includes('T')
          ? agendamento.data_consulta.split('T')[0].split('-').reverse() // Handle yyyy-mm-dd or similar if needed. Backend sends yyyy-mm-dd mostly.
          // Actually backend code I wrote sends .split('T')[0] from ISO string which is YYYY-MM-DD.
          // So split('-') gives [YYYY, MM, DD].
          : agendamento.data_consulta.split("-").reverse(); // If backend sends YYYY-MM-DD

        // Wait, Agendamento.ts in backend:
        // data_consulta: a.dataConsulta instanceof Date ? ... : ...
        // It returns ISO YYYY-MM-DD.
        // So split('-') results in ['YYYY', 'MM', 'DD'].
        // Let's parse correctly.

        const dateParts = agendamento.data_consulta.split('-');
        const year = parseInt(dateParts[0]);
        const month = parseInt(dateParts[1]);
        const day = parseInt(dateParts[2]);

        const [hora, minuto] = agendamento.horario_consulta.split(":");

        const start = new Date(year, month - 1, day, parseInt(hora), parseInt(minuto));
        const end = new Date(start.getTime() + 60 * 60 * 1000); // 1 hour duration

        return {
          id: agendamento.id,
          title: `Vet: ${agendamento.veterinario_nome} - ${formatEventTitle(
            agendamento.tutor_nome,
            agendamento.pet_nome || "Pet"
          )}`,
          start,
          end,
          resource: {
            cliente: agendamento.tutor_nome,
            clienteSobrenome: agendamento.tutor_sobrenome,
            tutorTelefone: agendamento.tutor_telefone,
            tutorEmail: agendamento.tutor_email,
            petId: agendamento.pet_id ?? null,
            pet: agendamento.pet_nome || "Pet",
            petRaca: agendamento.pet_raca,
            petPorte: agendamento.pet_porte,
            petEspecie: agendamento.pet_especie,
            petFotoUrl: agendamento.pet_foto_url,
            veterinario: agendamento.veterinario_nome,
            veterinarioSobrenome: agendamento.veterinario_sobrenome,
            tipo: agendamento.tipo_consulta,
            status: agendamento.status,
            observacoes: agendamento.observacoes,
            valor: agendamento.valor_total,
            horario: agendamento.horario_consulta,
          },
        };
      });
    } catch (error: any) {
      console.error("❌ [Dashboard Service] Erro ao buscar agendamentos:", error);
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
      let dataAlvoISO: string;
      if (data instanceof Date) {
        dataAlvoISO = formatDateToISO(data);
      } else if (typeof data === "string" && data.trim().length > 0) {
        dataAlvoISO = data;
      } else {
        const hoje = new Date();
        dataAlvoISO = formatDateToISO(hoje);
      }

      const response = await api.get("/clinicas/agendamentos", {
        params: {
          data_inicio: dataAlvoISO,
          data_fim: dataAlvoISO,
          status: "confirmado,pendente,em andamento,realizado,cancelado",
        },
      });

      if (!response.data.agendamentos || response.data.agendamentos.length === 0) {
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
        petRaca: agendamento.pet_raca,
        petPorte: agendamento.pet_porte,
        petEspecie: agendamento.pet_especie,
        petFotoUrl: agendamento.pet_foto_url,
        veterinario: agendamento.veterinario_nome,
        veterinarioSobrenome: agendamento.veterinario_sobrenome,
        horario: agendamento.horario_consulta,
        tipo: agendamento.tipo_consulta,
        data_consulta: agendamento.data_consulta,
        status: agendamento.status,
        observacoes: agendamento.observacoes,
        valor: agendamento.valor_total,
      }));
    } catch (error: any) {
      console.error("❌ [Dashboard Service] Erro ao buscar próximas consultas:", error);
      return [];
    }
  }
  static async uploadProfilePhoto(file: File) {
    const formData = new FormData();
    formData.append("profile_pic", file);
    const response = await api.post("/clinicas/upload-photo", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return response.data as { message: string; url: string };
  }

  static async vincularProfissional(veterinarioId: string) {
    const response = await api.post("/clinicas/professionals", { veterinarioId });
    return response.data;
  }

  static async desvincularProfissional(veterinarioId: string) {
    const response = await api.delete(`/clinicas/professionals/${veterinarioId}`);
    return response.data;
  }

  static async pesquisarProfissionais(search: string): Promise<Profissional[]> {
    const response = await api.get("/clinicas/professionals/search", {
      params: { search },
    });
    const rawVets = response.data.profissionais || [];
    return rawVets.map((v: any) => ({
      id: v.id,
      nome: v.user?.nome || "V",
      sobrenome: v.user?.sobrenome || "",
      email: v.user?.email || "",
      fotoUrl: v.fotoUrl,
      crmv: v.crmv
    }));
  }
}
