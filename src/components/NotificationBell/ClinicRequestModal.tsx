"use client";

import { useState } from "react";
import { Check, X, Building2, MapPin, Phone } from "lucide-react";
import { NotificationsService } from "@/services/notifications/notifications";
import styles from "./clinicRequestModal.module.css";

interface ClinicRequestModalProps {
    clinicaId: string;
    clinicaNome: string;
    onClose: () => void;
    onResponse: (success: boolean) => void;
}

export default function ClinicRequestModal({
    clinicaId,
    clinicaNome,
    onClose,
    onResponse
}: ClinicRequestModalProps) {
    const [loading, setLoading] = useState(false);
    const [action, setAction] = useState<"accept" | "reject" | null>(null);

    const handleAccept = async () => {
        setLoading(true);
        setAction("accept");
        try {
            await NotificationsService.acceptClinicLink(clinicaId);
            onResponse(true);
        } catch (err) {
            console.error("Erro ao aceitar vínculo:", err);
            alert("Erro ao aceitar vínculo. Tente novamente.");
        } finally {
            setLoading(false);
        }
    };

    const handleReject = async () => {
        setLoading(true);
        setAction("reject");
        try {
            await NotificationsService.rejectClinicLink(clinicaId);
            onResponse(true);
        } catch (err) {
            console.error("Erro ao recusar vínculo:", err);
            alert("Erro ao recusar vínculo. Tente novamente.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className={styles.overlay} onClick={onClose}>
            <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
                <div className={styles.header}>
                    <div className={styles.iconWrap}>
                        <Building2 size={24} />
                    </div>
                    <div className={styles.titleArea}>
                        <h3>Solicitação de Vínculo</h3>
                        <p>Uma clínica quer você no time dela</p>
                    </div>
                    <button className={styles.closeBtn} onClick={onClose}>
                        <X size={20} />
                    </button>
                </div>

                <div className={styles.content}>
                    <div className={styles.clinicCard}>
                        <div className={styles.clinicInfo}>
                            <span className={styles.label}>Clínica</span>
                            <span className={styles.value}>{clinicaNome}</span>
                        </div>
                    </div>

                    <p className={styles.description}>
                        Ao aceitar, seu perfil ficará visível na página desta clínica
                        e você poderá receber agendamentos realizados por lá.
                    </p>
                </div>

                <div className={styles.footer}>
                    <button
                        className={styles.rejectBtn}
                        onClick={handleReject}
                        disabled={loading}
                    >
                        {loading && action === "reject" ? "..." : "Recusar"}
                    </button>
                    <button
                        className={styles.acceptBtn}
                        onClick={handleAccept}
                        disabled={loading}
                    >
                        {loading && action === "accept" ? "Aceitando..." : "Aceitar vínculo"}
                        {!loading && <Check size={18} />}
                    </button>
                </div>
            </div>
        </div>
    );
}
