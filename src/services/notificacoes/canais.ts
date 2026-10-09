import { api } from "@/hook/api";

export type CanaisNotificacao = { email: boolean; whatsapp: boolean; google_agenda: boolean };

export const CanaisService = {
  async obter(): Promise<CanaisNotificacao> {
    const res = await api.get("/me/notificacoes");
    return res.data;
  },

  async salvar(data: { email?: boolean; whatsapp?: boolean }): Promise<CanaisNotificacao> {
    const res = await api.put("/me/notificacoes", data);
    return res.data;
  },

  async desconectarGoogleAgenda(): Promise<void> {
    await api.post("/google/calendar/disconnect");
  },
};
