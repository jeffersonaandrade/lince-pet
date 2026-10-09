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
    }, [user, loading, router]);

    const handleSaveAll = async () => {
        try {
            setIsSaving(true);
            await TutorService.updateProfile({ nome });
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
