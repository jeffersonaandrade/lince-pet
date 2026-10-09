import { api } from "@/hook/api";

export interface VeterinarioSignupData {
  nome: string;
  sobrenome: string;
  celular: string;
  email: string;
  password: string;
  cep: string;
  rua: string;
  bairro: string;
  cidade: string;
  estado: string;
  numero: string;
  cpf?: string;
}

// Create API instance


export const veterinarioSignup = async (data: VeterinarioSignupData) => {
  const response = await api.post("/veterinarios", data);
  return response.data;
};

export const createVeterinario = async () => {
  const response = await api.post("/veterinarios");
  return response.data;
};

export const submitOnboardingStep1 = async (
  _veterinarioId: string,
  data: { crmv: string }
) => {
  const response = await api.post(`/onboarding/step1`, data);
  return response.data;
};

export const submitOnboardingStep2 = async (
  _veterinarioId: string,
  data: { genero: string }
) => {
  const response = await api.post(`/onboarding/step2`, data);
  return response.data;
};

export const submitOnboardingStep3 = async (
  _veterinarioId: string,
  data: { especialidades: string[] }
) => {
  const response = await api.post(`/onboarding/step3`, data);
  return response.data;
};

interface Step4Location {
  rua: string;
  numero: string;
  bairro: string;
  complemento?: string;
  cidade: string;
  estado: string;
  cep: string;
  isPrimary: boolean;
  aceitaEmergencia: boolean;
  observacoes?: string;
  precoConsulta: number;
  horariosDisponibilidade: {
    [key: string]: string[];
  };
  fotoUrl?: string;
}

export const submitOnboardingStep4 = async (
  _veterinarioId: string,
  data: {
    visitTypes: { presencial: boolean; online: boolean };
    locations?: Step4Location[];
    precoConsultaOnline?: number;
  }
) => {
  const response = await api.post(`/onboarding/step4`, data);
  return response.data;
};


export interface Experience {
  local: string;
  cargo: string;
  dataInicio: string; // YYYY-MM-DD
  dataFim?: string; // YYYY-MM-DD
  descricao?: string;
  ativo?: boolean;
}

export const submitOnboardingStep5 = async (
  _veterinarioId: string,
  data: { experiencias: Experience[] }
) => {
  const response = await api.post(`/onboarding/step5`, data);
  return response.data;
};

export const submitOnboardingStep6 = async (
  _veterinarioId: string,
  data: { planos: string[] }
) => {
  const response = await api.post(`/onboarding/step6`, data);
  return response.data;
};

export const submitOnboardingStep7 = async (
  _veterinarioId: string,
  data: { about: string }
) => {
  const response = await api.post(`/onboarding/step7`, data);
  return response.data;
};

export const getOnboardingProgress = async () => {
  const response = await api.get(`/onboarding/progress`);
  return response.data;
};

export const completeVeterinarioOnboarding = async () => {
  const response = await api.post(`/onboarding/complete`);
  return response.data;
};

export const submitOnboardingStep = async (
  _veterinarioId: string,
  stepNumber: number,
  data: Record<string, unknown>
) => {
  const response = await api.post(`/onboarding/step${stepNumber}`, data);
  return response.data;
};

export const getEspecialidades = async () => {
  const response = await api.get("/especialidades");
  const items = (response.data?.data || response.data || []) as Array<{
    id: string;
    nome: string;
  }>;
  const norm = (s: string) =>
    s
      ?.replace(/\(\s*mock(?:up)?\s*\)/gi, "")
      .replace(/\s*-\s*mock(?:up)?/gi, "")
      .replace(/\s+mock(?:up)?$/gi, "")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();
  const seen = new Set<string>();
  const deduped: typeof items = [];
  for (const it of items) {
    const key = norm(it.nome);
    if (!key) continue;
    if (seen.has(key)) continue;
    seen.add(key);
    // devolve com nome limpo para evitar exibir sufixos mock na UI
    deduped.push({
      ...it,
      nome: it.nome
        .replace(/\(\s*mock(?:up)?\s*\)/gi, "")
        .replace(/\s*-\s*mock(?:up)?/gi, "")
        .replace(/\s+mock(?:up)?$/gi, "")
        .replace(/\s+/g, " ")
        .trim(),
    });
  }
  return { success: true, data: deduped };
};

export const getPlanos = async () => {
  const response = await api.get("/planos");
  return response.data;
};

export const uploadOnboardingPhoto = async (file: File) => {
  const formData = new FormData();
  // Backend aceita várias chaves; usamos a preferida `profile_pic`
  formData.append("profile_pic", file);
  const response = await api.post("/onboarding/photo", formData);
  return response.data as { message: string; url: string };
};

export const uploadOnboardingGeneric = async (file: File) => {
  const formData = new FormData();
  formData.append("file", file);
  const response = await api.post("/onboarding/upload-generic", formData);
  return response.data as { url: string };
};

export const uploadProfilePhoto = async (file: File) => {
  const formData = new FormData();
  formData.append("profile_pic", file);
  const response = await api.post("/veterinarios/profile/photo", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return response.data as { message: string; url: string };
};

export interface SearchVeterinarios {
  search?: string;
  cidade?: string;
  estado?: string;
  especialidade?: string;
  plano?: string;
}

export const searchVeterinarios = async (filters: SearchVeterinarios) => {
  const params = new URLSearchParams();

  if (filters.search) params.append("search", filters.search);
  if (filters.cidade) params.append("cidade", filters.cidade);
  if (filters.estado) params.append("estado", filters.estado);
  if (filters.especialidade)
    params.append("especialidade", filters.especialidade);
  if (filters.plano) params.append("plano", filters.plano);

  const response = await api.get(`/veterinarios/search?${params.toString()}`);
  return response.data;
};

export const getVeterinarioById = async (id: string) => {
  const response = await api.get(`/veterinarios/${id}`);
  return response.data;
};
