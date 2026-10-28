import { isAxiosError } from "axios";
import { api } from "@/hook/api";
import { formatEventTitle, formatDateToISO } from "@/utils/formatters";



export interface AgendamentoDashboard {
  duracaoMin?: number;
  id: number | string;
  cliente: string;
  clienteSobrenome?: string;
  tutorTelefone?: string | null;
  tutorWhatsappPermitido?: boolean;
  localNome?: string;
  localEndereco?: string;
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
    tutorWhatsappPermitido?: boolean;
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

/** Item de `GET /clinicas/agendamentos`. */
interface AgendamentoClinicaApi {
  duracao_min?: number;
  id: string;
  tutor_nome: string;
  tutor_sobrenome?: string;
  tutor_telefone?: string | null;
  tutor_whatsapp_permitido?: boolean;
  local_nome?: string;
  local_endereco?: string;
  tutor_email?: string | null;
  pet_id?: string | null;
  pet_nome?: string;
  pet_raca?: string;
  pet_porte?: string;
  pet_especie?: string;
  pet_foto_url?: string | null;
  veterinario_nome?: string;
  veterinario_sobrenome?: string;
  data_consulta: string;
  horario_consulta: string;
  tipo_consulta: string;
  status: string;
  observacoes?: string;
  valor_total?: number;
}

/** Veterinário como vem de `/clinicas/professionals` (lista e busca). */
interface ProfissionalApi {
  id: string;
  fotoUrl: string | null;
  crmv?: string;
  user?: { nome?: string; sobrenome?: string; email?: string } | null;
}

const profissionalDaApi = (v: ProfissionalApi): Profissional => ({
  id: v.id,
  nome: v.user?.nome || "V",
  sobrenome: v.user?.sobrenome || "",
  email: v.user?.email || "",
  fotoUrl: v.fotoUrl,
  crmv: v.crmv,
});

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
    } catch (error) {
      console.error(
        "❌ [Dashboard Service] Erro ao buscar estatísticas:",
        error
      );
      if (isAxiosError(error)) console.error("❌ [Dashboard Service] Response:", error.response?.data);

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
      const response = await api.get<{ profissionais?: ProfissionalApi[] }>("/clinicas/professionals");
      return (response.data.profissionais || []).map(profissionalDaApi);
    } catch (error) {
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

      const response = await api.get<{ agendamentos?: AgendamentoClinicaApi[] }>("/clinicas/agendamentos", {
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

      return response.data.agendamentos.map((agendamento) => {
        const dateParts = agendamento.data_consulta.split('-');
        const year = parseInt(dateParts[0]);
        const month = parseInt(dateParts[1]);
        const day = parseInt(dateParts[2]);

        const [hora, minuto] = agendamento.horario_consulta.split(":");

        const start = new Date(year, month - 1, day, parseInt(hora), parseInt(minuto));
        const end = new Date(start.getTime() + (agendamento.duracao_min ?? 30) * 60 * 1000);

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
            tutorWhatsappPermitido: agendamento.tutor_whatsapp_permitido,
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
            duracaoMin: agendamento.duracao_min ?? 30,
          },
        };
      });
    } catch (error) {
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

      const response = await api.get<{ agendamentos?: AgendamentoClinicaApi[] }>("/clinicas/agendamentos", {
        params: {
          data_inicio: dataAlvoISO,
          data_fim: dataAlvoISO,
          status: "confirmado,pendente,em andamento,realizado,cancelado",
        },
      });

      if (!response.data.agendamentos || response.data.agendamentos.length === 0) {
        return [];
      }

      return response.data.agendamentos.map((agendamento) => ({
        id: agendamento.id,
        cliente: agendamento.tutor_nome,
        clienteSobrenome: agendamento.tutor_sobrenome,
        tutorTelefone: agendamento.tutor_telefone,
        tutorWhatsappPermitido: agendamento.tutor_whatsapp_permitido,
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
        duracaoMin: agendamento.duracao_min ?? 30,
        tipo: agendamento.tipo_consulta,
        data_consulta: agendamento.data_consulta,
        status: agendamento.status,
        observacoes: agendamento.observacoes,
        localNome: agendamento.local_nome,
        localEndereco: agendamento.local_endereco,
        valor: agendamento.valor_total,
      }));
    } catch (error) {
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
    const response = await api.get<{ profissionais?: ProfissionalApi[] }>("/clinicas/professionals/search", {
      params: { search },
    });
    return (response.data.profissionais || []).map(profissionalDaApi);
  }
}
