"use client";

import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect, useState, useRef, useCallback } from "react";
import Image from "next/image";
import {
    ClinicaDashboardService,
    Profissional,
} from "@/services/clinicas/dashboard";
import {
    getClinicaOnboardingProgress,
    submitClinicaOnboardingStep1,
    submitClinicaOnboardingStep2,
    submitClinicaOnboardingStep3,
    submitClinicaOnboardingStep4,
    submitClinicaOnboardingStep5,
} from "@/services/clinicas/clinicas";
import { getEspecialidades, getPlanos } from "@/services/veterinarios/veterinarios";
import { Search, X, UserPlus, Trash2, CheckCircle } from "lucide-react";
import styles from "./perfil.module.css";

interface Especialidade {
    id: string | number;
    nome: string;
}

// Map of amenity keys to display labels
const COMODIDADES_MAP: Record<string, string> = {
    estacionamento: "Estacionamento",
    wifi: "Wi-Fi",
    acessibilidade: "Acessibilidade",
    petShop: "Pet Shop",
    banhoETosa: "Banho e Tosa",
    internacao: "Internação",
    cirurgia: "Cirurgia",
    laboratorio: "Laboratório",
    examesImagem: "Exames de Imagem",
    emergencia24h: "Emergência 24h",
};

const DIAS_SEMANA_MAP: Record<string, string> = {
    segunda: "Segunda-feira",
    terca: "Terça-feira",
    quarta: "Quarta-feira",
    quinta: "Quinta-feira",
    sexta: "Sexta-feira",
    sabado: "Sábado",
    domingo: "Domingo",
};
const DIAS_KEYS = Object.keys(DIAS_SEMANA_MAP);

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

export default function PerfilClinica() {
    const { user, loading, updateUser } = useAuth();
    const router = useRouter();

    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);

    // Toast
    const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
    const toastTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

    const showToast = useCallback((message: string, type: "success" | "error" = "success") => {
        if (toastTimeout.current) clearTimeout(toastTimeout.current);
        setToast({ message, type });
        toastTimeout.current = setTimeout(() => setToast(null), 3000);
    }, []);

    // ── Informações Básicas ────────────────────────────────────────────────────
    const [nome, setNome] = useState("");

    const [descricao, setDescricao] = useState("");
    const [telefone, setTelefone] = useState("");

    // ── Especialidades ─────────────────────────────────────────────────────────
    const [especialidadesDisponiveis, setEspecialidadesDisponiveis] = useState<Especialidade[]>([]);
    const [especialidadesSelecionadas, setEspecialidadesSelecionadas] = useState<(string | number)[]>([]);

    // ── Comodidades ────────────────────────────────────────────────────────────
    const [comodidades, setComodidades] = useState<Record<string, boolean>>(
        Object.fromEntries(Object.keys(COMODIDADES_MAP).map((k) => [k, false]))
    );

    // ── Horários ───────────────────────────────────────────────────────────────
    const [horarios, setHorarios] = useState<Record<string, string[]>>(
        Object.fromEntries(DIAS_KEYS.map((d) => [d, []]))
    );

    // ── Planos de Saúde ────────────────────────────────────────────────────────
    const [planosDisponiveis, setPlanosDisponiveis] = useState<{ id: string; name: string }[]>([]);
    const [planosSelecionados, setPlanosSelecionados] = useState<string[]>([]);

    // ── Profissionais Vinculados ───────────────────────────────────────────────
    const [profissionais, setProfissionais] = useState<Profissional[]>([]);
    const [searchTerm, setSearchTerm] = useState("");
    const [searchResults, setSearchResults] = useState<Profissional[]>([]);
    const [isSearching, setIsSearching] = useState(false);

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

    const [isAddingVet, setIsAddingVet] = useState<string | null>(null);
    const [isRemovingVet, setIsRemovingVet] = useState<string | null>(null);

    // ── Load Data ──────────────────────────────────────────────────────────────
    useEffect(() => {
        if (loading) return;
        if (!user || user.userType !== "clinica") {
            router.push("/login");
            return;
        }
        if (user) {
            if (user.nome) setNome(user.nome);
        }

        loadData();
    }, [user, loading]);

    const loadData = async () => {
        try {
            setIsLoading(true);

            // Load specialties available
            const espResponse = await getEspecialidades();
            if (espResponse.success && Array.isArray(espResponse.data)) {
                setEspecialidadesDisponiveis(espResponse.data);
            }

            // Load health plans
            const plansResponse = await getPlanos();
            if (plansResponse) {
                setPlanosDisponiveis(plansResponse);
            }

            // Load clinic onboarding/profile data
            const progress = await getClinicaOnboardingProgress();
            const clinica = progress?.clinica || progress?.data?.clinica || progress;

            if (clinica) {
                setDescricao(clinica.descricao || "");
                setTelefone(clinica.telefone || "");

                // Especialidades
                if (Array.isArray(clinica.especialidades)) {
                    setEspecialidadesSelecionadas(
                        clinica.especialidades.map((e: any) => e.id).filter(Boolean)
                    );
                }

                // Comodidades
                if (clinica.comodidades) {
                    let rawComod: Record<string, boolean> = clinica.comodidades;
                    if (typeof rawComod === "string") {
                        try {
                            rawComod = JSON.parse(rawComod);
                        } catch { }
                    }
                    setComodidades((prev) => ({ ...prev, ...rawComod }));
                }

                // Horários
                if (clinica.horariosFuncionamento) {
                    let rawHorarios = clinica.horariosFuncionamento;
                    if (typeof rawHorarios === "string") {
                        try {
                            rawHorarios = JSON.parse(rawHorarios);
                        } catch { }
                    }
                    // Normalize keys (remove accents & "-feira" suffix)
                    const normalizeKey = (k: string) =>
                        k
                            .toLowerCase()
                            .normalize("NFD")
                            .replace(/[\u0300-\u036f]/g, "")
                            .replace("-feira", "");
                    const normalized: Record<string, string[]> = {};
                    Object.keys(rawHorarios).forEach((k) => {
                        normalized[normalizeKey(k)] = rawHorarios[k];
                    });
                    setHorarios((prev) => ({ ...prev, ...normalized }));
                }

                // Planos
                if (Array.isArray(clinica.planos)) {
                    setPlanosSelecionados(clinica.planos.map((p: any) => p.id));
                }
            }

            // Load linked professionals
            const pros = await ClinicaDashboardService.buscarProfissionais();
            setProfissionais(pros);
        } catch (error) {
            console.error("Erro ao carregar dados do perfil da clínica:", error);
            showToast("Erro ao carregar dados do perfil.", "error");
        } finally {
            setIsLoading(false);
        }
    };

    // ── Generate Time Slots ────────────────────────────────────────────────────
    const generateTimeSlots = () => {
        const slots: string[] = [];
        for (let hour = 7; hour <= 22; hour++) {
            slots.push(`${hour.toString().padStart(2, "0")}:00`);
            slots.push(`${hour.toString().padStart(2, "0")}:30`);
        }
        slots.push("23:00");
        return slots;
    };

    const toggleTimeSlot = (day: string, time: string) => {
        setHorarios((prev) => {
            const current = prev[day] || [];
            const updated = current.includes(time)
                ? current.filter((t) => t !== time)
                : [...current, time].sort();
            return { ...prev, [day]: updated };
        });
        setHasUnsavedChanges(true);
    };

    const toggleEspecialidade = (id: string | number) => {
        setEspecialidadesSelecionadas((prev) =>
            prev.includes(id) ? prev.filter((e) => e !== id) : [...prev, id]
        );
        setHasUnsavedChanges(true);
    };

    const toggleComodidade = (key: string) => {
        setComodidades((prev) => ({ ...prev, [key]: !prev[key] }));
        setHasUnsavedChanges(true);
    };

    const togglePlano = (id: string) => {
        setPlanosSelecionados((prev) =>
            prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]
        );
        setHasUnsavedChanges(true);
    };

    // ── Save handlers ──────────────────────────────────────────────────────────
    const handleSaveAll = async () => {
        try {
            setIsSaving(true);
            await Promise.all([
                submitClinicaOnboardingStep4({ nome, descricao, telefone }),
                submitClinicaOnboardingStep1({ especialidades: especialidadesSelecionadas as string[] }),
                submitClinicaOnboardingStep2({ comodidades }),
                submitClinicaOnboardingStep3({ horariosFuncionamento: horarios }),
                submitClinicaOnboardingStep5({ planos: planosSelecionados })
            ]);
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


    // ── Professional handlers ──────────────────────────────────────────────────
    const handleSearch = async () => {
        if (searchTerm.trim().length < 2) return;
        try {
            setIsSearching(true);
            const results = await ClinicaDashboardService.pesquisarProfissionais(searchTerm.trim());
            setSearchResults(results);
        } catch (error) {
            console.error(error);
            showToast("Erro ao pesquisar veterinários.", "error");
        } finally {
            setIsSearching(false);
        }
    };

    const handleAddVet = async (vet: Profissional) => {
        try {
            setIsAddingVet(vet.id);
            await ClinicaDashboardService.vincularProfissional(vet.id);
            setProfissionais((prev) => [...prev, vet]);
            setSearchResults((prev) => prev.filter((v) => v.id !== vet.id));
            setHasUnsavedChanges(true);
            showToast(`${vet.nome} ${vet.sobrenome} vinculado com sucesso!`);
        } catch (error: any) {
            showToast(
                error?.response?.data?.message || "Erro ao vincular veterinário.",
                "error"
            );
        } finally {
            setIsAddingVet(null);
        }
    };

    const handleRemoveVet = async (vetId: string) => {
        if (!confirm("Tem certeza que deseja remover este profissional da clínica?")) return;
        try {
            setIsRemovingVet(vetId);
            await ClinicaDashboardService.desvincularProfissional(vetId);
            setProfissionais((prev) => prev.filter((v) => v.id !== vetId));
            setHasUnsavedChanges(true);
            showToast("Profissional removido com sucesso!");
        } catch (error) {
            showToast("Erro ao remover profissional.", "error");
        } finally {
            setIsRemovingVet(null);
        }
    };

    const linkedIds = new Set(profissionais.map((p) => p.id));

    if (loading || isLoading) {
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
                    <h1 className={styles.title}>Editar Perfil da Clínica</h1>
                    <button
                        className={styles.backButton}
                        onClick={() => {
                            if (hasUnsavedChanges && !window.confirm("Você tem alterações não salvas. Deseja sair sem salvar?")) {
                                return;
                            }
                            router.push("/dashboard/clinica");
                        }}
                    >
                        ← Voltar
                    </button>
                </div>

               

                {/* ── Informações Básicas ────────────────────────────────────────── */}
                <div className={styles.section}>
                    <h2 className={styles.sectionTitle}>Informações Básicas</h2>

                    <div className={styles.formGroup}>
                        <label className={styles.label}>Nome da Clínica</label>
                        <input
                            type="text"
                            className={styles.input}
                            value={nome}
                            onChange={(e) => setNome(e.target.value)}
                            placeholder="Ex: Clínica Lince Pet"
                        />
                    </div>
                    <div className={styles.formGroup}>
                        <label className={styles.label}>Telefone de Contato</label>
                        <input
                            type="text"
                            className={styles.input}
                            value={telefone}
                            onChange={(e) => setTelefone(e.target.value)}
                            placeholder="(00) 00000-0000"
                        />
                    </div>
                    <div className={styles.formGroup}>
                        <label className={styles.label}>Descrição da Clínica</label>
                        <textarea
                            className={styles.textarea}
                            value={descricao}
                            onChange={(e) => setDescricao(e.target.value)}
                            placeholder="Descreva sua clínica, diferenciais e serviços oferecidos..."
                            rows={5}
                        />
                    </div>
                </div>

                {/* ── Especialidades ────────────────────────────────────────────── */}
                <div className={styles.section}>
                    <h2 className={styles.sectionTitle}>Especialidades Atendidas</h2>
                    <p className={styles.sectionDescription}>
                        Selecione as especialidades disponíveis na sua clínica.
                    </p>
                    <div className={styles.especialidadesGrid}>
                        {especialidadesDisponiveis.map((esp) => (
                            <button
                                key={esp.id}
                                className={`${styles.especialidadeChip} ${especialidadesSelecionadas.includes(esp.id)
                                    ? styles.selected
                                    : ""
                                    }`}
                                onClick={() => toggleEspecialidade(esp.id)}
                            >
                                {esp.nome}
                            </button>
                        ))}
                    </div>
                </div>

                {/* ── Comodidades ───────────────────────────────────────────────── */}
                <div className={styles.section}>
                    <h2 className={styles.sectionTitle}>Estrutura e Comodidades</h2>
                    <p className={styles.sectionDescription}>
                        Informe quais comodidades sua clínica oferece.
                    </p>
                    <div className={styles.especialidadesGrid}>
                        {Object.entries(COMODIDADES_MAP).map(([key, label]) => (
                            <button
                                key={key}
                                className={`${styles.especialidadeChip} ${comodidades[key] ? styles.selected : ""
                                    }`}
                                onClick={() => toggleComodidade(key)}
                            >
                                {label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* ── Horários de Funcionamento ─────────────────────────────────── */}
                <div className={styles.section}>
                    <h2 className={styles.sectionTitle}>Horários de Funcionamento</h2>
                    <p className={styles.sectionDescription}>
                        Selecione os horários disponíveis para agendamento em cada dia da
                        semana.
                    </p>

                    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
                        {DIAS_KEYS.map((day) => (
                            <div key={day}>
                                <div
                                    className={styles.label}
                                    style={{ marginBottom: "0.6rem" }}
                                >
                                    {DIAS_SEMANA_MAP[day]}
                                </div>
                                <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem" }}>
                                    {generateTimeSlots().map((time) => {
                                        const isSelected = (horarios[day] || []).includes(time);
                                        return (
                                            <button
                                                key={time}
                                                type="button"
                                                onClick={() => toggleTimeSlot(day, time)}
                                                style={{
                                                    padding: "0.4rem 0.7rem",
                                                    border: `2px solid ${isSelected ? "var(--primary)" : "#e0e0e0"}`,
                                                    borderRadius: "6px",
                                                    background: isSelected ? "var(--primary)" : "#fff",
                                                    color: isSelected ? "#fff" : "#555",
                                                    fontSize: "0.82rem",
                                                    fontWeight: 500,
                                                    cursor: "pointer",
                                                    transition: "all 0.15s",
                                                    minWidth: "56px",
                                                    textAlign: "center",
                                                }}
                                            >
                                                {time}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        ))}
                    </div>

                </div>

                {/* ── Planos de Saúde ───────────────────────────────────────────── */}
                <div className={styles.section}>
                    <h2 className={styles.sectionTitle}>Planos de Saúde Atendidos</h2>
                    <p className={styles.sectionDescription}>
                        Selecione os planos de saúde que sua clínica aceita.
                    </p>
                    <div className={styles.especialidadesGrid}>
                        {planosDisponiveis.map((plano) => (
                            <button
                                key={plano.id}
                                className={`${styles.especialidadeChip} ${planosSelecionados.includes(plano.id)
                                    ? styles.selected
                                    : ""
                                    }`}
                                onClick={() => togglePlano(plano.id)}
                            >
                                {plano.name}
                            </button>
                        ))}
                    </div>
                </div>

                {/* ── Profissionais Vinculados ──────────────────────────────────── */}
                <div className={styles.section}>
                    <h2 className={styles.sectionTitle}>Profissionais da Clínica</h2>
                    <p className={styles.sectionDescription}>
                        Gerencie os veterinários associados à sua clínica. Eles aparecerão
                        no perfil público e poderão ter consultas agendadas.
                    </p>

                    {/* Search */}
                    <div className={styles.vetSearchRow}>
                        <input
                            type="text"
                            className={styles.vetSearchInput}
                            placeholder="Buscar veterinário por nome, e-mail ou CRMV..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                        />
                        <button
                            className={styles.searchButton}
                            onClick={handleSearch}
                            disabled={isSearching || searchTerm.trim().length < 2}
                        >
                            <Search size={16} />
                            {isSearching ? "Buscando..." : "Buscar"}
                        </button>
                    </div>

                    {/* Search Results */}
                    {searchResults.length > 0 && (
                        <div className={styles.searchResultsBox}>
                            {searchResults.map((vet) => {
                                const alreadyLinked = linkedIds.has(vet.id);
                                return (
                                    <div key={vet.id} className={styles.searchResultItem}>
                                        <div className={styles.vetAvatar}>
                                            {vet.fotoUrl ? (
                                                <Image
                                                    src={vet.fotoUrl}
                                                    alt={vet.nome}
                                                    width={48}
                                                    height={48}
                                                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                                                />
                                            ) : (
                                                (vet.nome?.charAt(0) || "V").toUpperCase()
                                            )}
                                        </div>
                                        <div className={styles.vetInfo}>
                                            <div className={styles.vetName}>
                                                {vet.nome} {vet.sobrenome}
                                            </div>
                                            <div className={styles.vetMeta}>
                                                {vet.email}
                                                {vet.crmv ? ` • CRMV ${vet.crmv}` : ""}
                                            </div>
                                        </div>
                                        {alreadyLinked ? (
                                            <span className={styles.alreadyLinked}>
                                                <CheckCircle size={14} style={{ verticalAlign: "middle", marginRight: 4 }} />
                                                Já vinculado
                                            </span>
                                        ) : (
                                            <button
                                                className={styles.addButton}
                                                onClick={() => handleAddVet(vet)}
                                                disabled={isAddingVet === vet.id}
                                            >
                                                <UserPlus size={14} style={{ verticalAlign: "middle", marginRight: 4 }} />
                                                {isAddingVet === vet.id ? "Adicionando..." : "Adicionar"}
                                            </button>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    {searchResults.length === 0 && searchTerm && !isSearching && (
                        <p
                            style={{
                                fontSize: "0.9rem",
                                color: "#64748b",
                                marginBottom: "1rem",
                                padding: "0.75rem",
                                background: "#f8fafc",
                                borderRadius: "8px",
                            }}
                        >
                            Nenhum veterinário encontrado para "{searchTerm}". Verifique o
                            nome ou CRMV.
                        </p>
                    )}

                    {/* Linked Professionals */}
                    <div style={{ marginTop: "1.5rem" }}>
                        <p
                            style={{
                                fontSize: "0.85rem",
                                fontWeight: 600,
                                color: "#475569",
                                marginBottom: "0.75rem",
                                textTransform: "uppercase",
                                letterSpacing: "0.05em",
                            }}
                        >
                            Profissionais vinculados ({profissionais.length})
                        </p>

                        {profissionais.length > 0 ? (
                            <div className={styles.vetList}>
                                {profissionais.map((vet) => (
                                    <div key={vet.id} className={styles.vetCard}>
                                        <div className={styles.vetAvatar}>
                                            {vet.fotoUrl ? (
                                                <Image
                                                    src={vet.fotoUrl}
                                                    alt={vet.nome}
                                                    width={48}
                                                    height={48}
                                                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                                                />
                                            ) : (
                                                (vet.nome?.charAt(0) || "V").toUpperCase()
                                            )}
                                        </div>
                                        <div className={styles.vetInfo}>
                                            <div className={styles.vetName}>
                                                {vet.nome} {vet.sobrenome}
                                            </div>
                                            <div className={styles.vetMeta}>
                                                {vet.email}
                                                {vet.crmv ? ` • CRMV ${vet.crmv}` : ""}
                                            </div>
                                        </div>
                                        <button
                                            className={styles.removeButton}
                                            onClick={() => handleRemoveVet(vet.id)}
                                            disabled={isRemovingVet === vet.id}
                                            title="Remover profissional"
                                        >
                                            <Trash2
                                                size={14}
                                                style={{ verticalAlign: "middle", marginRight: 4 }}
                                            />
                                            {isRemovingVet === vet.id ? "Removendo..." : "Remover"}
                                        </button>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className={styles.emptyState}>
                                <UserPlus size={32} style={{ marginBottom: "0.5rem", opacity: 0.4 }} />
                                <p style={{ fontWeight: 500 }}>Nenhum profissional vinculado ainda</p>
                                <p style={{ fontSize: "0.85rem", marginTop: "0.25rem" }}>
                                    Use a busca acima para encontrar e adicionar veterinários.
                                </p>
                            </div>
                        )}
                    </div>
                </div>

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
