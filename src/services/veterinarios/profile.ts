import { api } from "@/hook/api";

export interface VeterinarioProfileUpdate {
  nome?: string;
  bio?: string;
  especialidades?: (string | number)[];
  endereco?: {
    rua?: string;
    numero?: string;
    bairro?: string;
    complemento?: string;
    cidade?: string;
    estado?: string;
    cep?: string;
    nomeClinica?: string;
  };
  atendeOnline?: boolean;
  precoConsultaOnline?: number;
  horariosOnline?: {
    [key: string]: string[];
  };
  experiencias?: {
    local: string;
    cargo: string;
    dataInicio: string;
    dataFim?: string;
    descricao?: string;
    ativo?: boolean;
  }[];
  planos?: string[];
}

export interface VeterinarioHorario {
  id?: number;
  diaSemana: number; // 0-6 (0=Domingo, 6=Sábado)
  horaInicio: string; // HH:mm
  horaFim: string; // HH:mm
  ativo: boolean;
}



export const VeterinarioProfileService = {
  /**
   * Update veterinarian profile
   */
  async updateProfile(data: VeterinarioProfileUpdate): Promise<{ message: string }> {
    const response = await api.put('/veterinarios/profile', data);
    return response.data;
  },

  /**
   * Get veterinarian schedule
   */
  async getSchedule(): Promise<{ horarios: VeterinarioHorario[] }> {
    const response = await api.get('/veterinarios/schedule');
    return response.data;
  },

  /**
   * Update veterinarian schedule
   */
  async updateSchedule(horarios: VeterinarioHorario[]): Promise<{ message: string }> {
    const response = await api.put('/veterinarios/schedule', { horarios });
    return response.data;
  },

  /**
   * Update specific location
   */
  async updateLocation(id: number, data: any): Promise<{ message: string; endereco: any }> {
    const response = await api.put(`/veterinarios/locations/${id}`, data);
    return response.data;
  },

  /**
   * Add new location
   */
  async addLocation(data: any): Promise<{ message: string; endereco: any }> {
    const response = await api.post('/veterinarios/locations', data);
    return response.data;
  },

  /**
   * Upload location photo
   */
  async uploadLocationPhoto(id: string | number, file: File): Promise<{ url: string; message: string }> {
    const formData = new FormData();
    formData.append('photo', file);
    const response = await api.post(`/veterinarios/locations/${id}/photo`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },
};

