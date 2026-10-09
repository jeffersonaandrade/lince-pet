import { api } from "@/hook/api";

export interface BloqueioAgenda {
  id: string;
  veterinario_id: string;
  data_inicio: string;
  data_fim: string | null;
  recorrente: boolean;
  /** 0 = domingo ... 6 = sábado (só para recorrente). */
  dias_semana: number[];
  dia_inteiro: boolean;
  horarios: string[];
  motivo: string | null;
  clinica_id: string | null;
  created_at: string | null;
}

export interface ConflitoBloqueio {
  id: string;
  data_consulta: string | null;
  horario_consulta: string | null;
  status: string;
  tipo_consulta: string | null;
  tutor_nome: string | null;
  pet_nome: string | null;
  payment_status: string;
}

export interface BloqueioPayload {
  data_inicio: string;
  data_fim?: string | null;
  recorrente?: boolean;
  dias_semana?: number[] | null;
  horarios?: string[] | null;
  motivo?: string | null;
}

export interface BloqueioResult {
  bloqueio: BloqueioAgenda | null;
  conflitos: ConflitoBloqueio[];
}

/** Quem está gerenciando a agenda: o próprio vet ou uma clínica com vínculo aceito. */
export type BloqueioScope =
  | { tipo: "veterinario" }
  | { tipo: "clinica"; veterinarioId: string };

const baseUrl = (scope: BloqueioScope) =>
  scope.tipo === "veterinario"
    ? "/veterinarios/bloqueios"
    : `/clinicas/veterinarios/${scope.veterinarioId}/bloqueios`;

const deleteUrl = (scope: BloqueioScope, id: string) =>
  scope.tipo === "veterinario" ? `/veterinarios/bloqueios/${id}` : `/clinicas/bloqueios/${id}`;

export const errorMessage = (error: unknown, fallback: string) => {
  const data = (error as { response?: { data?: { message?: string } } })?.response?.data;
  return data?.message || fallback;
};

export const BloqueiosService = {
  async listar(scope: BloqueioScope, de?: string, ate?: string): Promise<BloqueioAgenda[]> {
    const response = await api.get(baseUrl(scope), { params: { de, ate } });
    return response.data?.data || [];
  },

  async preview(scope: BloqueioScope, payload: BloqueioPayload): Promise<BloqueioResult> {
    const response = await api.post(`${baseUrl(scope)}?preview=1`, payload);
    return response.data;
  },

  async criar(scope: BloqueioScope, payload: BloqueioPayload): Promise<BloqueioResult> {
    const response = await api.post(baseUrl(scope), payload);
    return response.data;
  },

  async remover(scope: BloqueioScope, id: string): Promise<void> {
    await api.delete(deleteUrl(scope, id));
  },
};

export const DIAS_SEMANA_CURTO = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

const toISO = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** Recorrentes sem data final são expandidos até 1 ano à frente (suficiente para o calendário). */
const HORIZONTE_RECORRENTE_DIAS = 366;

/** Datas (YYYY-MM-DD) cobertas pelos bloqueios, com indicação de dia inteiro ou parcial. */
export function mapearDiasBloqueados(bloqueios: BloqueioAgenda[]): Record<string, "dia" | "parcial"> {
  const dias: Record<string, "dia" | "parcial"> = {};
  for (const b of bloqueios) {
    const cursor = new Date(`${b.data_inicio}T00:00:00`);
    const limite = new Date(cursor);
    limite.setDate(limite.getDate() + HORIZONTE_RECORRENTE_DIAS);
    const fim = b.data_fim ? new Date(`${b.data_fim}T00:00:00`) : limite;
    while (cursor <= fim && cursor <= limite) {
      if (!b.recorrente || b.dias_semana.includes(cursor.getDay())) {
        const key = toISO(cursor);
        if (b.dia_inteiro) dias[key] = "dia";
        else if (!dias[key]) dias[key] = "parcial";
      }
      cursor.setDate(cursor.getDate() + 1);
    }
  }
  return dias;
}
