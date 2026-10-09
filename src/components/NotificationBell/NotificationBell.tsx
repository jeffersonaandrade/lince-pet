"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Bell, Check, CheckCheck, Calendar, Star, Link2, X, AlertCircle, CheckCircle, Send } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import {
    NotificationsService,
    NotificationItem,
} from "@/services/notifications/notifications";
import ClinicRequestModal from "./ClinicRequestModal";
import { dashboardDoTipo } from "@/utils/tipoConta";
import styles from "./notificationBell.module.css";

// ============================================================
// Mapeia cada TYPE de notificação para um ícone e uma cor
// Isso permite que cada tipo tenha uma identidade visual
// ============================================================
const NOTIFICATION_CONFIG: Record<
    string,
    { icon: React.ReactNode; color: string }
> = {
    NOVO_AGENDAMENTO: {
        icon: <Calendar size={18} />,
        color: "#22c55e", // verde
    },
    AGENDAMENTO_REAGENDADO: {
        icon: <Calendar size={18} />,
        color: "#e67e22", // laranja
    },
    AGENDAMENTO_CANCELADO: {
        icon: <X size={18} />,
        color: "#ef4444", // vermelho
    },
    AGENDAMENTO_CONFIRMADO: {
        icon: <Check size={18} />,
        color: "#3b82f6", // azul
    },
    AVALIACAO_RECEBIDA: {
        icon: <Star size={18} />,
        color: "#eab308", // amarelo
    },
    VINCULO_CLINICA_SOLICITADO: {
        icon: <Link2 size={18} />,
        color: "#8b5cf6", // roxo
    },
    AGENDAMENTO_CONCLUIDO: {
        icon: <CheckCircle size={18} />,
        color: "#10b981", // esmeralda
    },
    RESPOSTA_VINCULO: {
        icon: <Link2 size={18} />,
        color: "#f59e0b", // âmbar
    },
    PEDIDO_NOVO: { icon: <Calendar size={18} />, color: "#22c55e" },
    PEDIDO_ACEITO: { icon: <Check size={18} />, color: "#3b82f6" },
    PEDIDO_RECUSADO: { icon: <X size={18} />, color: "#ef4444" },
    PEDIDO_CANCELADO: { icon: <X size={18} />, color: "#ef4444" },
    PEDIDO_REMARCADO: { icon: <Calendar size={18} />, color: "#e67e22" },
    PEDIDO_CONCLUIDO: { icon: <CheckCircle size={18} />, color: "#10b981" },
    NOVA_AVALIACAO: { icon: <Star size={18} />, color: "#eab308" },
    ENCAMINHAMENTO_NOVO: { icon: <Send size={18} />, color: "#8b5cf6" },
    ENCAMINHAMENTO_ACEITO: { icon: <Check size={18} />, color: "#22c55e" },
    ENCAMINHAMENTO_RECUSADO: { icon: <X size={18} />, color: "#ef4444" },
};

// Ícone/cor padrão caso o type não esteja mapeado
const DEFAULT_CONFIG = {
    icon: <AlertCircle size={18} />,
    color: "#6b7280",
};

// ============================================================
// Função utilitária para formatar "há X tempo"
// ============================================================
function timeAgo(dateString: string | undefined): string {
    if (!dateString) return "Recentemente";

    const now = new Date();
    const date = new Date(dateString);

    // Verifica se a data é válida
    if (isNaN(date.getTime())) return "Recentemente";

    const diffMs = now.getTime() - date.getTime();
    const diffMin = Math.floor(diffMs / 60000);

    if (diffMin < 1) return "Agora";
    if (diffMin < 60) return `${diffMin}min atrás`;

    const diffHours = Math.floor(diffMin / 60);
    if (diffHours < 24) return `${diffHours}h atrás`;

    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return `${diffDays}d atrás`;

    // Se for mais de 7 dias, mostra a data resumida
    return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}

// ============================================================
// Componente principal: NotificationBell
// ============================================================
interface NotificationBellProps {
    variant?: "desktop" | "mobile" | "dropdown";
    onNavigate?: () => void;
    className?: string;
    unreadCount?: number;
    onUnreadCountChange?: (count: number) => void;
}

export default function NotificationBell({ 
    variant = "desktop", 
    onNavigate, 
    className,
    unreadCount = 0,
    onUnreadCountChange 
}: NotificationBellProps = {}) {
    const { user } = useAuth();
    const router = useRouter();

    // Estados do componente
    const [isOpen, setIsOpen] = useState(false);
    const [notifications, setNotifications] = useState<NotificationItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [markingAll, setMarkingAll] = useState(false);

    // Estado para o Modal de Solicitação de Clínica
    const [requestData, setRequestData] = useState<{ id: string; nome: string } | null>(null);

    // Ref para fechar ao clicar fora
    const panelRef = useRef<HTMLDivElement>(null);

    // ----------------------------------------------------------
    // 2. Buscar lista de notificações ao abrir o painel
    // ----------------------------------------------------------
    const fetchNotifications = useCallback(async () => {
        if (!user) return;
        setLoading(true);
        try {
            const result = await NotificationsService.list(1);
            setNotifications(result.data);
        } catch (err) {
            console.error("Erro ao buscar notificações:", err);
        } finally {
            setLoading(false);
        }
    }, [user]);

    // Quando abre o painel, busca as notificações
    useEffect(() => {
        if (isOpen) {
            fetchNotifications();
        }
    }, [isOpen, fetchNotifications]);

    // ----------------------------------------------------------
    // 3. Fechar painel ao clicar fora
    // ----------------------------------------------------------
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
                setIsOpen(false);
            }
        };

        if (isOpen) {
            document.addEventListener("mousedown", handleClickOutside);
        }
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [isOpen]);

    // ----------------------------------------------------------
    // 4. Ações
    // ----------------------------------------------------------
    const handleMarkAsRead = async (notif: NotificationItem) => {
        // Redirecionamento baseado no tipo
        const navigate = () => {
            setIsOpen(false);
            if (onNavigate) onNavigate();
            if (notif.type.startsWith('PEDIDO_') || notif.type === 'NOVA_AVALIACAO') {
                router.push(dashboardDoTipo(user?.userType));
            } else if (notif.type.startsWith('ENCAMINHAMENTO_')) {
                router.push(`${dashboardDoTipo(user?.userType)}#encaminhamentos`);
            } else if (notif.type === 'NOVO_AGENDAMENTO' || notif.type === 'AGENDAMENTO_CANCELADO' || notif.type === 'AGENDAMENTO_REAGENDADO') {
                router.push(dashboardDoTipo(user?.userType));
            } else if (notif.type === 'AGENDAMENTO_CONFIRMADO') {
                router.push('/dashboard/tutor');
            } else if (notif.type === 'AVALIACAO_RECEBIDA') {
                router.push(dashboardDoTipo(user?.userType));
            } else if (notif.type === 'VINCULO_CLINICA_SOLICITADO') {
                if (notif.action_data?.isRequest) {
                    setRequestData({
                        id: notif.action_data.clinicaId,
                        nome: notif.action_data.clinicaNome
                    });
                } else {
                    router.push('/dashboard/veterinario');
                }
            } else if (notif.type === 'AGENDAMENTO_CONCLUIDO') {
                router.push('/dashboard/tutor');
            } else if (notif.type === 'RESPOSTA_VINCULO') {
                router.push(user?.userType === 'clinica' ? '/dashboard/clinica' : '/');
            }
        };

        if (notif.is_read) {
            navigate();
            return;
        }

        try {
            await NotificationsService.markAsRead(notif.id);

            // Atualiza localmente sem precisar refetch
            setNotifications((prev) =>
                prev.map((n) => (n.id === notif.id ? { ...n, is_read: true } : n))
            );
            if (onUnreadCountChange) {
                onUnreadCountChange(Math.max(0, unreadCount - 1));
            }
            navigate();
        } catch (err) {
            console.error("Erro ao marcar como lida:", err);
            navigate(); // Navega mesmo se der erro ao marcar como lida
        }
    };

    const handleMarkAllAsRead = async () => {
        setMarkingAll(true);
        try {
            await NotificationsService.markAllAsRead();

            // Atualiza localmente
            setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
            if (onUnreadCountChange) {
                onUnreadCountChange(0);
            }
        } catch (err) {
            console.error("Erro ao marcar todas como lidas:", err);
        } finally {
            setMarkingAll(false);
        }
    };

    // Se não tem usuário logado, não mostra nada
    if (!user) return null;

    return (
        <div className={variant === "mobile" ? styles.mobileBellContainer : variant === "dropdown" ? styles.dropdownBellContainer : styles.bellContainer} ref={panelRef}>
            {/* Botão do sininho */}
            {variant === "mobile" ? (
                <button
                    className={className || styles.mobileMenuBtn}
                    onClick={() => setIsOpen(!isOpen)}
                    aria-label={`Notificações${unreadCount > 0 ? ` (${unreadCount} não lidas)` : ""}`}
                >
                    <span className={styles.mobileMenuIcon}>
                        <Bell size={18} />
                    </span>
                    Notificações
                    {unreadCount > 0 && (
                        <span className={styles.mobileMenuBadge}>
                            {unreadCount > 99 ? "99+" : unreadCount}
                        </span>
                    )}
                </button>
            ) : variant === "dropdown" ? (
                <button
                    className={className}
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); setIsOpen(!isOpen); }}
                    aria-label={`Notificações${unreadCount > 0 ? ` (${unreadCount} não lidas)` : ""}`}
                >
                    <Bell size={16} />
                    <span>Notificações</span>
                    {unreadCount > 0 && (
                        <span className={styles.dropdownBadge}>
                            {unreadCount > 99 ? "99+" : unreadCount}
                        </span>
                    )}
                </button>
            ) : (
                <button
                    className={styles.bellButton}
                    onClick={() => setIsOpen(!isOpen)}
                    aria-label={`Notificações${unreadCount > 0 ? ` (${unreadCount} não lidas)` : ""}`}
                >
                    <Bell size={20} />
                    {unreadCount > 0 && (
                        <span className={styles.badge}>
                            {unreadCount > 99 ? "99+" : unreadCount}
                        </span>
                    )}
                </button>
            )}

            {/* Painel dropdown de notificações */}
            {isOpen && (
                <div className={styles.panel}>
                    {/* Header do painel */}
                    <div className={styles.panelHeader}>
                        <h3 className={styles.panelTitle}>Notificações</h3>
                        {unreadCount > 0 && (
                            <button
                                className={styles.markAllBtn}
                                onClick={handleMarkAllAsRead}
                                disabled={markingAll}
                            >
                                <CheckCheck size={14} />
                                {markingAll ? "Marcando..." : "Marcar todas como lidas"}
                            </button>
                        )}
                    </div>

                    {/* Lista de notificações */}
                    <div className={styles.notificationList}>
                        {loading ? (
                            <div className={styles.emptyState}>
                                <div className={styles.loadingDots}>
                                    <span></span><span></span><span></span>
                                </div>
                                <p>Carregando...</p>
                            </div>
                        ) : notifications.length === 0 ? (
                            <div className={styles.emptyState}>
                                <Bell size={32} strokeWidth={1.5} />
                                <p>Nenhuma notificação ainda</p>
                            </div>
                        ) : (
                            notifications.map((notif) => {
                                const config =
                                    NOTIFICATION_CONFIG[notif.type] || DEFAULT_CONFIG;

                                return (
                                    <button
                                        key={notif.id}
                                        className={`${styles.notificationItem} ${!notif.is_read ? styles.unread : ""}`}
                                        onClick={() => handleMarkAsRead(notif)}
                                    >
                                        {/* Ícone do tipo de notificação */}
                                        <div
                                            className={styles.iconWrap}
                                            style={{ backgroundColor: `${config.color}15`, color: config.color }}
                                        >
                                            {config.icon}
                                        </div>

                                        {/* Conteúdo textual */}
                                        <div className={styles.notifContent}>
                                            <span className={styles.notifTitle}>{notif.title}</span>
                                            <span className={styles.notifMessage}>{notif.message}</span>
                                            <span className={styles.notifTime}>
                                                {timeAgo(notif.created_at)}
                                            </span>
                                        </div>

                                        {/* Indicador de não-lida (bolinha) */}
                                        {!notif.is_read && <div className={styles.unreadDot} />}
                                    </button>
                                );
                            })
                        )}
                    </div>
                </div>
            )}
            {/* Modal de Solicitação de Vínculo */}
            {requestData && (
                <ClinicRequestModal
                    clinicaId={requestData.id}
                    clinicaNome={requestData.nome}
                    onClose={() => setRequestData(null)}
                    onResponse={(success) => {
                        setRequestData(null);
                        if (success) fetchNotifications();
                    }}
                />
            )}
        </div>
    );
}
