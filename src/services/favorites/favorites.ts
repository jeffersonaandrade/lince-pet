import { api } from "@/hook/api";

export interface CheckFavoriteResponse {
  isFavorited: boolean;
  favoriteId?: string;
}

/** Item de `GET /favorites`: o favorito com o veterinário ou a clínica carregados. */
export interface Favorito {
  id: string;
  veterinario?: {
    id: string;
    fotoUrl?: string | null;
    user?: { nome: string } | null;
    enderecos?: { cidade?: string | null; estado?: string | null }[];
  } | null;
  clinica?: {
    id: string;
    nomeClinica?: string | null;
    fotoPerfil?: string | null;
    cidade?: string | null;
    estado?: string | null;
    user?: { nome: string } | null;
  } | null;
}

export const FavoritesService = {
  check: async (veterinarioId?: string, clinicaId?: string): Promise<CheckFavoriteResponse> => {
    const params: Record<string, string> = {};
    if (veterinarioId) params.veterinarioId = veterinarioId;
    if (clinicaId) params.clinicaId = clinicaId;

    const response = await api.get('/favorites/check', { params });
    return response.data;
  },

  add: async (veterinarioId?: string, clinicaId?: string) => {
    const response = await api.post('/favorites', { veterinarioId, clinicaId });
    return response.data;
  },

  remove: async (favoriteId: string) => {
    await api.delete(`/favorites/${favoriteId}`);
  },

  list: async (): Promise<Favorito[]> => {
    const response = await api.get('/favorites');
    return Array.isArray(response.data) ? response.data : [];
  }
};
