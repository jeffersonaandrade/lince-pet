import { api } from "@/hook/api";
import type { ClinicaDetalheApi } from "@/lib/clinica-perfil";



export const getClinicaOnboardingProgress = async () => {
  const response = await api.get("/clinicas/onboarding/progress");
  return response.data;
};

export const submitClinicaOnboardingStep1 = async (data: { especialidades: string[] }) => {
  const response = await api.post("/clinicas/onboarding/step1", data);
  return response.data;
};

export const submitClinicaOnboardingStep2 = async (data: { comodidades: Record<string, boolean> }) => {
  const response = await api.post("/clinicas/onboarding/step2", data);
  return response.data;
};

export const submitClinicaOnboardingStep3 = async (data: { horariosFuncionamento: Record<string, string[]> }) => {
  const response = await api.post("/clinicas/onboarding/step3", data);
  return response.data;
};

export const submitClinicaOnboardingStep4 = async (data: { nome?: string; descricao?: string; fotoUrl?: string; telefone?: string }, photoFile?: File) => {
  // If photo is provided, upload it or send as multipart
  if (photoFile) {
    const formData = new FormData();
    formData.append("fotoPerfil", photoFile);
    if (data.descricao !== undefined) {
      formData.append("descricao", data.descricao);
    }
    if (data.telefone !== undefined) {
      formData.append("telefone", data.telefone);
    }
    const response = await api.post("/clinicas/onboarding/step4", formData, {
      headers: { "Content-Type": "multipart/form-data" }
    });
    return response.data;
  } else {
    const response = await api.post("/clinicas/onboarding/step4", data);
    return response.data;
  }
};

export const submitClinicaOnboardingStep5 = async (data: { planos: string[] }) => {
  const response = await api.post("/clinicas/onboarding/step5", data);
  return response.data;
};

export const completeClinicaOnboarding = async () => {
  const response = await api.post("/clinicas/onboarding/complete");
  return response.data;
};

/** Filtros da busca pública (`GET /clinicas`). */
export type FiltrosBusca = Partial<Record<"search" | "especialidade" | "cidade" | "estado" | "plano", string>>;

export const searchClinicas = async (filters: FiltrosBusca = {}) => {
  const response = await api.get("/clinicas", { params: filters });
  return response.data;
};

export const getClinicaById = async (id: string) => {
  const response = await api.get<ClinicaDetalheApi>(`/clinicas/${id}`);
  return response.data;
};
