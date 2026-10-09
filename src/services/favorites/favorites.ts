import { api } from "@/hook/api";



export interface CheckFavoriteResponse {
  isFavorited: boolean;
  favoriteId?: string;
}

export const FavoritesService = {
  check: async (veterinarioId?: string, clinicaId?: string): Promise<CheckFavoriteResponse> => {
    const params: any = {};
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

  list: async () => {
    const response = await api.get('/favorites');
    return response.data;
  }
};
