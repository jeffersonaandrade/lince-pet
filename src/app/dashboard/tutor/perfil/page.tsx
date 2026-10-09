"use client";

import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect, useState, useRef, useCallback } from "react";
import { TutorService } from "@/services/tutor/tutor";
import { api } from "@/hook/api";
import styles from "./perfil.module.css";

function Toast({
    message,
    type,
}: {
    message: string;
    type: "success" | "error";
}) {
    return (
        <div className={`${styles.toast} ${styles[type]}`}>{message}</div>
    );
}

export default function PerfilTutor() {
    const { user, loading, updateUser, checkAuth } = useAuth();
    const router = useRouter();

    const [isSaving, setIsSaving] = useState(false);
    const [nome, setNome] = useState("");
    const [whatsappOptIn, setWhatsappOptIn] = useState(true);

    // Unsaved changes tracking
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

    useEffect(() => {
        const handleBeforeUnload = (e: BeforeUnloadEvent) => {
            if (hasUnsavedChanges) {
                e.preventDefault();
                e.returnValue = "";
            }
        };
        window.addEventListener("beforeunload", handleBeforeUnload);
        return () => window.removeEventListener("beforeunload", handleBeforeUnload);
    }, [hasUnsavedChanges]);

    // Toast
    const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
    const toastTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

    const showToast = useCallback((message: string, type: "success" | "error" = "success") => {
        if (toastTimeout.current) clearTimeout(toastTimeout.current);
        setToast({ message, type });
        toastTimeout.current = setTimeout(() => setToast(null), 3000);
    }, []);

    useEffect(() => {
        if (loading) return;
        if (!user || user.userType !== "tutor") {
            router.push("/login");
            return;
        }
        if (user.nome) {
            setNome(user.nome);
        }
        TutorService.getPreferencias()
            .then((p) => setWhatsappOptIn(p.whatsapp_opt_in))
            .catch(() => {});
    }, [user, loading, router]);

    const handleSaveAll = async () => {
        try {
            setIsSaving(true);
            await TutorService.updateProfile({ nome, whatsapp_opt_in: whatsappOptIn });
            if (updateUser && user) updateUser({ ...user, nome });
            setHasUnsavedChanges(false);
            showToast("Informações salvas com sucesso!");
        } catch (error) {
            console.error(error);
            showToast("Erro ao salvar informações.", "error");
        } finally {
            setIsSaving(false);
        }
    };



    if (loading) {
        return (
            <div className={styles.loadingContainer}>
                <p>Carregando...</p>
            </div>
        );
    }

    return (
        <div className={styles.pageBackground}>
            <div className={styles.container} onChange={() => setHasUnsavedChanges(true)}>
                {/* Header */}
                <div className={styles.header}>
                    <h1 className={styles.title}>Editar Perfil do Tutor</h1>
                    <button
                        className={styles.backButton}
                        onClick={() => {
                            if (hasUnsavedChanges && !window.confirm("Você tem alterações não salvas. Deseja sair sem salvar?")) {
                                return;
                            }
                            router.push("/dashboard/tutor");
                        }}
                    >
                        ← Voltar
                    </button>
                </div>

                {/* ── Informações Básicas ────────────────────────────────────────── */}
                <div className={styles.section}>
                    <h2 className={styles.sectionTitle}>Informações Básicas</h2>

                    <div className={styles.formGroup}>
                        <label className={styles.label}>Nome do Tutor</label>
                        <input
                            type="text"
                            className={styles.input}
                            value={nome}
                            onChange={(e) => setNome(e.target.value)}
                            placeholder="Ex: João da Silva"
                        />
                    </div>
                </div>

                <div className={styles.section}>
                    <h2 className={styles.sectionTitle}>Notificações</h2>
                    <label className="flex cursor-pointer items-start gap-3">
                        <input
                            type="checkbox"
                            className="mt-1 h-4 w-4 accent-orange-500"
                            checked={whatsappOptIn}
                            onChange={(e) => setWhatsappOptIn(e.target.checked)}
                        />
                        <span className="flex flex-col gap-1">
                            <span className="text-sm font-semibold text-slate-800">
                                Receber avisos de consultas por WhatsApp
                            </span>
                            <span className="text-xs text-slate-500">
                                Confirmação, lembretes (24h e 2h antes), cancelamento e remarcação, enviados pelo número
                                da Lince Pet para o celular do seu cadastro. O e-mail e os avisos no app continuam.
                            </span>
                        </span>
                    </label>
                </div>

                {/* ── Integrações Removidas do Tutor ────────────────────────────────────────── */}

                <div style={{ marginTop: '2rem', display: 'flex', justifyContent: 'flex-end', paddingBottom: '2rem' }}>
                    <button
                        className={styles.mainSaveButton}
                        onClick={handleSaveAll}
                        disabled={isSaving}
                    >
                        {isSaving ? "Salvando..." : "Salvar Informações"}
                    </button>
                </div>
            </div>

            {/* Toast Notification */}
            {toast && <Toast message={toast.message} type={toast.type} />}
        </div>
    );
}
