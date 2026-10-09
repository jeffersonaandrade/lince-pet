import { api } from "@/hook/api";



// ============================================================
// Interface que representa uma notificação vinda do backend
// ============================================================
export interface NotificationItem {
    id: string;
    type: string; // Ex: 'NOVO_AGENDAMENTO', 'AVALIACAO_RECEBIDA', etc.
    title: string;
    message: string;
    is_read: boolean;
    action_data: Record<string, any> | null;
    created_at: string;
}

// ============================================================
// Interface para a resposta paginada do backend (padrão Adonis)
// ============================================================
export interface NotificationsPaginatedResponse {
    meta: {
        total: number;
        per_page: number;
        current_page: number;
        last_page: number;
    };
    data: NotificationItem[];
}

// ============================================================
// Service centralizado para chamadas de API de notificações
// ============================================================
export class NotificationsService {
    /**
     * Lista notificações do usuário logado (paginado)
     * Chama: GET /notifications?page=X
     */
    static async list(page = 1): Promise<NotificationsPaginatedResponse> {
        const response = await api.get(`/notifications?page=${page}`);
        return response.data;
    }

    /**
     * Retorna a contagem de notificações não lidas
     * Chama: GET /notifications/unread-count
     */
    static async getUnreadCount(): Promise<number> {
        const response = await api.get("/notifications/unread-count");
        return response.data.unreadCount;
    }

    /**
     * Marca UMA notificação como lida
     * Chama: PATCH /notifications/:id/read
     */
    static async markAsRead(notificationId: string): Promise<void> {
        await api.patch(`/notifications/${notificationId}/read`);
    }

    /**
     * Marca TODAS as notificações como lidas
     * Chama: PATCH /notifications/read-all
     */
    static async markAllAsRead(): Promise<void> {
        await api.patch("/notifications/read-all");
    }

    /**
     * Aceita um convite de clínica
     */
    static async acceptClinicLink(clinicaId: string): Promise<void> {
        await api.patch(`/veterinarios/vinculos/${clinicaId}/aceitar`);
    }

    /**
     * Recusa um convite de clínica
     */
    static async rejectClinicLink(clinicaId: string): Promise<void> {
        await api.patch(`/veterinarios/vinculos/${clinicaId}/recusar`);
    }
}
