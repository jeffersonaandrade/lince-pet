"use client";

import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect, useState, useRef, useCallback } from "react";
import { VeterinarioProfileService } from "@/services/veterinarios/profile";
import { getOnboardingProgress, getEspecialidades, getPlanos, type Experience } from "@/services/veterinarios/veterinarios";
import { Clock, ChevronDown, ChevronUp, Plus, X, Trash2, Crown } from "lucide-react";
import ProfileImageUploader from "@/components/ProfileImageUploader/ProfileImageUploader";
import { PreferenciasNotificacao, ConexaoGoogleAgenda } from "@/components/PreferenciasNotificacao/PreferenciasNotificacao";
import { AssinaturasService } from "@/services/assinaturas/assinaturas";
import styles from "./perfil.module.css";
import { useFeatureGate } from "@/hook/useFeatureGate";
import PremiumGateModal from "@/components/PremiumGateModal/PremiumGateModal";

interface Especialidade {
  id: string | number;
  nome: string;
}

interface Endereco {
  id?: number;
  nomeClinica?: string;
  rua: string;
  numero: string;
  bairro: string;
  complemento?: string;
  cidade: string;
  estado: string;
  cep: string;
  precoConsulta?: number;
  aceitaEmergencia?: boolean;
  observacoes?: string;
  horariosDisponibilidade?: {
    [key: string]: string[];
  };
  fotoUrl?: string;
}

const DIAS_SEMANA_MAP: { [key: string]: string } = {
  segunda: "Segunda-feira",
  terca: "Terça-feira",
  quarta: "Quarta-feira",
  quinta: "Quinta-feira",
  sexta: "Sexta-feira",
  sabado: "Sábado",
  domingo: "Domingo",
};

const DIAS_SEMANA_KEYS = ["segunda", "terca", "quarta", "quinta", "sexta", "sabado", "domingo"];

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


export default function PerfilVeterinario() {
  const { user, loading, checkAuth } = useAuth();
  const router = useRouter();
  const assinaturas = AssinaturasService();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [vetPlanoAtual, setVetPlanoAtual] = useState<string | null>(null);
  
  const { hasFeature } = useFeatureGate();
  const [isPremiumModalOpen, setIsPremiumModalOpen] = useState(false);
  const [premiumModalFeature, setPremiumModalFeature] = useState("");
  const [premiumModalPlan, setPremiumModalPlan] = useState<"Pro" | "Pro+">("Pro");

  const resolveCurrentPlan = useCallback((vet?: any): string | null => {
    if (!vet || !Array.isArray(vet.planos) || vet.planos.length === 0)
      return null;
    const arr = vet.planos;
    const isActive = (p?: string) => {
      const v = (p || "").toLowerCase();
      return v === "active" || v === "ativo" || v === "ativa";
    };
    const active = arr.find((p: any) => p.isActive || isActive(p.status));
    if (active) return active.code || active.name || null;
    const sorted = [...arr].sort((a, b) => {
      const ad = a.createdAt ? Date.parse(a.createdAt) : 0;
      const bd = b.createdAt ? Date.parse(b.createdAt) : 0;
      if (ad !== bd) return bd - ad;
      const ai = typeof a.id === "number" ? a.id : -1;
      const bi = typeof b.id === "number" ? b.id : -1;
      return bi - ai;
    });
    const first = sorted[0];
    return (first && (first.code || first.name)) || null;
  }, []);

  // Profile data
  const [nome, setNome] = useState("");

  const [bio, setBio] = useState("");
  const [especialidadesDisponiveis, setEspecialidadesDisponiveis] = useState<Especialidade[]>([]);
  const [especialidadesSelecionadas, setEspecialidadesSelecionadas] = useState<(string | number)[]>([]);

  // Experience and Plans
  const [experiencias, setExperiencias] = useState<Experience[]>([]);
  const [planos, setPlanos] = useState<string[]>([]);
  const [availablePlans, setAvailablePlans] = useState<{ id: string; name: string }[]>([]);
  const [newExperience, setNewExperience] = useState<Experience>({
    local: "",
    cargo: "",
    dataInicio: "",
    dataFim: "",
    descricao: "",
    ativo: false
  });


  // Teleconsulta State
  const [atendeOnline, setAtendeOnline] = useState(false);
  const [precoConsultaOnline, setPrecoConsultaOnline] = useState(0);
  const [horariosOnline, setHorariosOnline] = useState<{ [key: string]: string[] }>({
    segunda: [], terca: [], quarta: [], quinta: [], sexta: [], sabado: [], domingo: []
  });
  const [showOnlineSchedule, setShowOnlineSchedule] = useState(true);

  // Toast
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const toastTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((message: string, type: "success" | "error" = "success") => {
    if (toastTimeout.current) clearTimeout(toastTimeout.current);
    setToast({ message, type });
    toastTimeout.current = setTimeout(() => setToast(null), 3000);
  }, []);


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

  const [enderecos, setEnderecos] = useState<Endereco[]>([]);

  // UI State
  const [expandedLocationIndex, setExpandedLocationIndex] = useState<number | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newLocation, setNewLocation] = useState<Partial<Endereco>>({
    rua: "",
    numero: "",
    bairro: "",
    cidade: "",
    estado: "",
    cep: "",
    complemento: "",
    precoConsulta: 0,
    horariosDisponibilidade: {
      segunda: [], terca: [], quarta: [], quinta: [], sexta: [], sabado: [], domingo: []
    }
  });

  useEffect(() => {
    if (loading) return;

    if (!user || user.userType !== "veterinario") {
      router.push("/login");
      return;
    }

    loadProfileData();
  }, [user, loading, router]);

  const loadProfileData = async () => {
    try {
      setIsLoading(true);

      // Load available specialties and plans
      const [especialidadesResponse, planosResponse] = await Promise.all([
        getEspecialidades(),
        getPlanos()
      ]);

      if (especialidadesResponse.success && Array.isArray(especialidadesResponse.data)) {
        setEspecialidadesDisponiveis(especialidadesResponse.data);
      }
      if (planosResponse) {
        setAvailablePlans(planosResponse);
      }

      // Load profile data from onboarding progress
      const progress: any = await getOnboardingProgress();
      const progressData = progress.data || progress;
      const vet = progressData.veterinario;

      if (vet) {
        if (user?.nome) setNome(user.nome);
        setBio(vet.bio || "");

        const resolved = resolveCurrentPlan(vet);
        let actualPlan = resolved;

        try {
          const statusData = await assinaturas.obterStatus();
          if (statusData?.plan?.code) {
            actualPlan = statusData.plan.code;
          }
        } catch (e) {
          console.warn("Failed to load subscription status for profile", e);
        }

        setVetPlanoAtual(actualPlan);

        // Load specialties
        if (Array.isArray(vet.especialidades)) {
          const ids = vet.especialidades.map((e: any) => e.id).filter(Boolean);
          setEspecialidadesSelecionadas(ids);
        }

        // Load Experience
        setExperiencias(vet.experiencias || []);

        // Load Plans
        if (vet.planos && Array.isArray(vet.planos)) {
          setPlanos(vet.planos.map((p: any) => p.id));
        }

        // Load Teleconsulta Data
        setAtendeOnline(!!vet.atendeOnline);
        setPrecoConsultaOnline(Number(vet.precoConsultaOnline || 0));
        if (vet.horariosOnline) {
          let onlineHours = vet.horariosOnline;
          if (typeof onlineHours === 'string') {
            try {
              onlineHours = JSON.parse(onlineHours);
            } catch (e) {
              console.error("Error parsing horariosOnline", e);
              onlineHours = {};
            }
          }

          // Ensure it has all keys
          const merged = {
            segunda: [], terca: [], quarta: [], quinta: [], sexta: [], sabado: [], domingo: [],
            ...onlineHours
          };
          setHorariosOnline(merged);
        }

        // Load addresses
        if (Array.isArray(vet.enderecos)) {
          const processedEnderecos = vet.enderecos.map((end: any) => ({
            id: end.id,
            nomeClinica: end.nomeClinica || "",
            rua: end.rua || "",
            numero: end.numero || "",
            bairro: end.bairro || "",
            complemento: end.complemento || "",
            cidade: end.cidade || "",
            estado: end.estado || "",
            cep: end.cep || "",
            precoConsulta: Number(end.precoConsulta || 0),
            aceitaEmergencia: end.aceitaEmergencia,
            observacoes: end.observacoes || "",
            horariosDisponibilidade: end.horariosDisponibilidade || {
              segunda: [], terca: [], quarta: [], quinta: [], sexta: [], sabado: [], domingo: []
            },
            fotoUrl: end.fotoUrl || "",
          }));
          setEnderecos(processedEnderecos);
        }
      }

    } catch (error) {
      console.error("Erro ao carregar dados do perfil:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveAll = async () => {
    try {
      setIsSaving(true);
      await VeterinarioProfileService.updateProfile({
        nome,
        bio,
        especialidades: especialidadesSelecionadas,
        atendeOnline,
        precoConsultaOnline,
        horariosOnline,
        experiencias,
        planos
      });

      // Salvar os locais de atendimento
      const locationPromises = enderecos.map((loc) => {
        if (loc.id) {
          return VeterinarioProfileService.updateLocation(loc.id, loc);
        }
        return Promise.resolve();
      });
      await Promise.all(locationPromises);

      setHasUnsavedChanges(false);
      showToast("Informações salvas com sucesso!");
    } catch (error) {
      console.error("Erro ao salvar perfil:", error);
      showToast("Erro ao salvar informações. Tente novamente.", "error");
    } finally {

      setIsSaving(false);
    }
  };

  

  const updateOnlineSchedule = (day: string, time: string) => {
    const currentSchedule = horariosOnline[day] || [];
    const newDaySchedule = currentSchedule.includes(time)
      ? currentSchedule.filter((t) => t !== time)
      : [...currentSchedule, time].sort();

    setHorariosOnline({
      ...horariosOnline,
      [day]: newDaySchedule
    });
    setHasUnsavedChanges(true);
  };

  const toggleEspecialidade = (id: string | number) => {
    setEspecialidadesSelecionadas((prev) =>
      prev.includes(id) ? prev.filter((e) => e !== id) : [...prev, id]
    );
    setHasUnsavedChanges(true);
  };

  const generateTimeSlots = () => {
    const slots = [];
    for (let hour = 8; hour <= 23; hour++) {
      slots.push(`${hour.toString().padStart(2, "0")}:00`);
      if (hour < 23) {
        slots.push(`${hour.toString().padStart(2, "0")}:30`);
      }
    }
    // Add final 23:30 slot
    slots.push("23:30");
    return slots;
  };

  const toggleAccordion = (index: number) => {
    setExpandedLocationIndex(expandedLocationIndex === index ? null : index);
  };

  // Format currency
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  // Update a specific location field in the state (local edit)
  const updateLocalLocation = (index: number, field: keyof Endereco, value: any) => {
    const updatedEnderecos = [...enderecos];
    updatedEnderecos[index] = { ...updatedEnderecos[index], [field]: value };
    setEnderecos(updatedEnderecos);
    setHasUnsavedChanges(true);
  };

  // Update schedule for a specific location
  const updateLocalSchedule = (index: number, day: string, time: string) => {
    const updatedEnderecos = [...enderecos];
    const currentSchedule = updatedEnderecos[index].horariosDisponibilidade || {};
    const daySchedule = currentSchedule[day] || [];

    const newDaySchedule = daySchedule.includes(time)
      ? daySchedule.filter((t) => t !== time)
      : [...daySchedule, time].sort();

    updatedEnderecos[index] = {
      ...updatedEnderecos[index],
      horariosDisponibilidade: {
        ...currentSchedule,
        [day]: newDaySchedule
      }
    };
    setEnderecos(updatedEnderecos);
    setHasUnsavedChanges(true);
  };

  // Save functionality for a single location
  const handleSaveLocation = async (index: number) => {
    const location = enderecos[index];
    if (!location.id) return;

    try {
      setIsSaving(true);
      // Call backend update
      await VeterinarioProfileService.updateLocation(location.id, location);
      showToast("Localização atualizada com sucesso!");
    } catch (error) {
      console.error("Erro ao salvar localização:", error);
      showToast("Erro ao salvar localização.", "error");
    } finally {

      setIsSaving(false);
    }
  };

  const handleLocationPhotoUpload = async (index: number, file: File) => {
    if (!file) return;

    const locationId = enderecos[index].id;
    if (!locationId) {
      alert("Por favor, salve a localização antes de enviar uma foto.");
      return;
    }

    try {
      setIsSaving(true);
      const res = await VeterinarioProfileService.uploadLocationPhoto(locationId, file);
      const updated = [...enderecos];
      updated[index] = { ...updated[index], fotoUrl: res.url };
      setEnderecos(updated);
      setHasUnsavedChanges(true);
      showToast("Foto do local atualizada com sucesso!");
    } catch (error) {
      console.error("Erro ao enviar foto:", error);
      showToast("Erro ao enviar foto.", "error");
    } finally {

      setIsSaving(false);
    }
  };

  // Add New Location Logic
  const handleAddNewLocation = async () => {
    try {
      if (!newLocation.rua || !newLocation.cidade || !newLocation.estado || !newLocation.cep) {
        alert("Preencha os campos obrigatórios de endereço.");
        return;
      }

      setIsSaving(true);
      const added = await VeterinarioProfileService.addLocation(newLocation);

      // Refresh list
      await loadProfileData();
      setShowAddModal(false);
      setNewLocation({
        rua: "", numero: "", bairro: "", cidade: "", estado: "", cep: "", complemento: "", precoConsulta: 0,
        horariosDisponibilidade: { segunda: [], terca: [], quarta: [], quinta: [], sexta: [], sabado: [], domingo: [] }
      });
      showToast("Localização adicionada com sucesso!");
    } catch (error) {
      console.error("Erro ao adicionar localização:", error);
      showToast("Erro ao adicionar localização.", "error");
    } finally {

      setIsSaving(false);
    }
  };

  if (loading || isLoading) {
    return (
      <div className={styles.loadingContainer}>
        <p>Carregando...</p>
      </div>
    );
  }

  const canUseCalendar = hasFeature("agendamentos_ilimitados"); // Ou qualquer outra feature que corresponda ao Pro/Pro+

  return (
    <div className={styles.pageBackground}>
      <div className={styles.container} onChange={() => setHasUnsavedChanges(true)}>
        <div className={styles.header}>
          <h1 className={styles.title}>Editar Perfil</h1>
          <button
            className={styles.backButton}
            onClick={() => {
              if (hasUnsavedChanges && !window.confirm("Você tem alterações não salvas. Deseja sair sem salvar?")) {
                return;
              }
              router.push("/dashboard/veterinario");
            }}
          >
            ← Voltar
          </button>
        </div>

        <PremiumGateModal
          isOpen={isPremiumModalOpen}
          onClose={() => setIsPremiumModalOpen(false)}
          featureName={premiumModalFeature}
          requiredPlan={premiumModalPlan}
        />

        {/* Basic Info Section */}
        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>Informações Básicas</h2>

          <div className={styles.formGroup}>
            <label className={styles.label}>Nome do Veterinário</label>
            <input
              type="text"
              className={styles.input}
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Ex: Dr. João da Silva"
            />
          </div>
          <div className={styles.formGroup}>
            <label className={styles.label}>Biografia</label>
            <textarea
              className={styles.textarea}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Conte um pouco sobre você e sua experiência..."
              rows={5}
            />
          </div>

        </div>

        {/* ── Avisos de consulta ────────────────────────────────────────── */}
        <div className={styles.section}>
          <PreferenciasNotificacao onAviso={showToast}>
            <ConexaoGoogleAgenda
              conectado={Boolean(user?.googleCalendarAuthorized)}
              onAlterado={checkAuth}
              onAviso={showToast}
              bloqueio={
                canUseCalendar ? undefined : (
                  <button
                    type="button"
                    onClick={() => {
                      setPremiumModalFeature("Sincronização com Google Agenda");
                      setPremiumModalPlan("Pro");
                      setIsPremiumModalOpen(true);
                    }}
                    className="flex items-center gap-2 rounded-lg bg-orange-500 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-600"
                  >
                    <Crown size={18} /> Assinar Pro
                  </button>
                )
              }
            />
          </PreferenciasNotificacao>
        </div>

        {/* Especialidades Section */}
        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>Especialidades</h2>
          <p className={styles.sectionDescription}>
             Selecione suas áreas de atuação na medicina veterinária.
          </p>
          <div className={styles.formGroup}>
            <div className={styles.especialidadesGrid}>
              {especialidadesDisponiveis.map((esp) => (
                <button
                  key={esp.id}
                  className={`${styles.especialidadeChip} ${especialidadesSelecionadas.includes(esp.id) ? styles.selected : ""
                    }`}
                  onClick={() => toggleEspecialidade(esp.id)}
                >
                  {esp.nome}
                </button>
              ))}
            </div>
          </div>

        </div>

        {/* Experience Section */}
        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>Experiência Profissional</h2>

          {/* Form to add experience */}
          <div className={styles.experienceForm} style={{ marginBottom: 20, padding: 20, border: '1px solid #e5e7eb', borderRadius: 8 }}>
            <h4 style={{ marginBottom: 10, fontSize: 14, fontWeight: 600 }}>Adicionar Nova Experiência</h4>
            <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
              <div style={{ flex: 1 }}>
                <input
                  type="text"
                  placeholder="Cargo (ex: Veterinário Senior)"
                  className={styles.input}
                  value={newExperience.cargo}
                  onChange={e => setNewExperience({ ...newExperience, cargo: e.target.value })}
                />
              </div>
              <div style={{ flex: 1 }}>
                <input
                  type="text"
                  placeholder="Local / Empresa"
                  className={styles.input}
                  value={newExperience.local}
                  onChange={e => setNewExperience({ ...newExperience, local: e.target.value })}
                />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>Data Início</label>
                <input
                  type="date"
                  className={styles.input}
                  value={newExperience.dataInicio}
                  onChange={e => setNewExperience({ ...newExperience, dataInicio: e.target.value })}
                />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>Data Fim (Vazio se atual)</label>
                <input
                  type="date"
                  className={styles.input}
                  value={newExperience.dataFim || ''}
                  onChange={e => setNewExperience({ ...newExperience, dataFim: e.target.value })}
                />
              </div>
            </div>
            <div style={{ marginBottom: 10 }}>
              <textarea
                placeholder="Descrição das atividades..."
                className={styles.textarea}
                style={{ height: 80 }}
                value={newExperience.descricao || ''}
                onChange={e => setNewExperience({ ...newExperience, descricao: e.target.value })}
              />
            </div>
            <button
              className={styles.addLocationButton}
              style={{ marginTop: 0 }}
              onClick={() => {
                if (!newExperience.cargo || !newExperience.local || !newExperience.dataInicio) {
                  alert("Preencha cargo, local e data de início");
                  return;
                }
                setExperiencias([...experiencias, { ...newExperience, ativo: !newExperience.dataFim }]);
                setNewExperience({
                  local: "", cargo: "", dataInicio: "", dataFim: "", descricao: "", ativo: false
                });
                setHasUnsavedChanges(true);
              }}
            >
              <Plus size={16} /> Adicionar
            </button>
          </div>

          {/* List */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {experiencias.map((exp, idx) => (
              <div key={idx} style={{ padding: 15, border: '1px solid #eee', borderRadius: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontWeight: 'bold' }}>{exp.cargo}</div>
                  <div style={{ fontSize: 14, color: '#666' }}>{exp.local} | {exp.dataInicio} - {exp.dataFim || 'Atualmente'}</div>
                  {exp.descricao && <div style={{ fontSize: 12, color: '#888', marginTop: 4 }}>{exp.descricao}</div>}
                </div>
                <button
                  onClick={() => {
                    setExperiencias(experiencias.filter((_, i) => i !== idx));
                    setHasUnsavedChanges(true);
                  }}
                  style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: 5 }}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>

        </div>

        {/* Plans Section */}
        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>Planos de Saúde Aceitos</h2>
          <div className={styles.especialidadesGrid}>
            {availablePlans.map((plan) => (
              <button
                key={plan.id}
                className={`${styles.especialidadeChip} ${planos.includes(plan.id) ? styles.selected : ""}`}
                onClick={() => {
                  if (planos.includes(plan.id)) {
                    setPlanos(planos.filter(id => id !== plan.id));
                  } else {
                    setPlanos([...planos, plan.id]);
                  }
                  setHasUnsavedChanges(true);
                }}
              >
                {plan.name}
              </button>
            ))}
          </div>
        </div>

        {/* Teleconsulta Section */}
        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>Teleconsulta</h2>
          <div className={styles.switchContainer}>
            <label className={styles.switchLabel}>
              <input
                type="checkbox"
                checked={atendeOnline}
                onChange={(e) => {
                  setAtendeOnline(e.target.checked);
                  setHasUnsavedChanges(true);
                }}
                className={styles.switchInput}
              />
              <span className={styles.switchSlider}></span>
              <span className={styles.switchText}>Atendo via Teleconsulta</span>
            </label>
          </div>

          {atendeOnline && (
            <div className={styles.teleconsultaContent}>
              <div className={styles.formGroup}>
                <label className={styles.label}>Valor da Teleconsulta</label>
                <div className={styles.priceInputContainer}>
                  <span className={styles.currencyPrefix}>R$</span>
                  <input
                    type="text"
                    className={`${styles.input} ${styles.priceInput}`}
                    value={precoConsultaOnline || ''}
                    onChange={(e) => {
                      const value = e.target.value.replace(/[^0-9]/g, '');
                      setPrecoConsultaOnline(value === '' ? 0 : Number(value));
                    }}
                    placeholder="0"
                  />
                </div>
              </div>

              <button
                className={styles.accordionHeader}
                style={{ width: '100%', marginTop: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '15px', border: '1px solid #e5e7eb', borderRadius: '8px', background: 'white', cursor: 'pointer' }}
                onClick={() => setShowOnlineSchedule(!showOnlineSchedule)}
              >
                <span style={{ fontWeight: 600 }}>Horários de Atendimento Online</span>
                {showOnlineSchedule ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
              </button>

              {showOnlineSchedule && (
                <div className={styles.horariosSection} style={{ marginTop: '15px' }}>
                  {DIAS_SEMANA_KEYS.map((day) => (
                    <div key={day} className={styles.daySchedule}>
                      <div className={styles.dayLabel}>{DIAS_SEMANA_MAP[day]}</div>
                      <div className={styles.timeSlots}>
                        {generateTimeSlots().map((time) => (
                          <button
                            key={time}
                            type="button"
                            onClick={() => updateOnlineSchedule(day, time)}
                            className={`${styles.timeSlot} ${horariosOnline[day]?.includes(time)
                              ? styles.selected
                              : ""
                              }`}
                          >
                            {time}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}

            </div>
          )}
        </div>

        {/* Locations Section with Accordion */}
        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>Locais de Atendimento</h2>
          <p className={styles.sectionDescription}>
            Gerencie seus locais de atendimento, preços e horários.
          </p>

          <div className={styles.accordionList}>
            {enderecos.map((endereco, index) => (
              <div key={endereco.id || index} className={`${styles.accordionItem} ${expandedLocationIndex === index ? styles.active : ''}`}>
                <div className={styles.accordionHeader} onClick={() => toggleAccordion(index)}>
                  <div className={styles.locationSummary}>
                    <div className={styles.locationTitle}>
                      {endereco.nomeClinica ? `${endereco.nomeClinica} - ` : ''}{endereco.bairro ? `${endereco.bairro}, ` : ''}{endereco.cidade}
                    </div>
                    <div className={styles.locationSubtitle}>
                      {endereco.rua}, {endereco.numero}
                    </div>
                  </div>
                  <div className={styles.accordionIcon}>
                    <ChevronDown size={20} />
                  </div>
                </div>

                <div className={`${styles.accordionContent} ${expandedLocationIndex === index ? styles.open : ''}`}>
                  {/* Photo Upload */}
                  <div className={styles.locationPhotoSection}>
                    <label className={styles.label}>Foto do Local</label>
                    <ProfileImageUploader
                      currentImageUrl={endereco.fotoUrl}
                      userName={endereco.nomeClinica || "Local"}
                      onUpload={(file) => handleLocationPhotoUpload(index, file)}
                      isUploading={isSaving}
                      borderRadius="8px"
                      cropShape="square"
                      className={styles.locationImageUploader}
                    />
                    <p className={styles.fieldHelp}>Esta imagem aparecerá no seu perfil para os tutores. Clique para alterar.</p>
                  </div>

                  {/* Nome da Clínica Edit */}
                  <div className={styles.formGroup}>
                    <label className={styles.label}>Nome da Clínica (Opcional)</label>
                    <input
                      type="text"
                      className={styles.input}
                      value={endereco.nomeClinica || ""}
                      onChange={(e) => updateLocalLocation(index, 'nomeClinica', e.target.value)}
                      placeholder="Ex: Clínica PetLove"
                    />
                  </div>

                  {/* Price Edit */}
                  <div className={styles.formGroup}>
                    <label className={styles.label}>Valor da Consulta (Neste local)</label>
                    <div className={styles.priceInputContainer}>
                      <span className={styles.currencyPrefix}>R$</span>
                      <input
                        type="text"
                        className={`${styles.input} ${styles.priceInput}`}
                        value={endereco.precoConsulta || ''}
                        onChange={(e) => {
                          const value = e.target.value.replace(/[^0-9]/g, '');
                          updateLocalLocation(index, 'precoConsulta', value === '' ? 0 : Number(value));
                        }}
                        placeholder="0"
                      />
                    </div>
                  </div>

                  {/* Schedule Edit */}
                  <p className={styles.sectionDescription}>
                    Selecione os horários disponíveis para este local:
                  </p>
                  <div className={styles.horariosSection}>
                    {DIAS_SEMANA_KEYS.map((day) => (
                      <div key={day} className={styles.daySchedule}>
                        <div className={styles.dayLabel}>{DIAS_SEMANA_MAP[day]}</div>
                        <div className={styles.timeSlots}>
                          {generateTimeSlots().map((time) => (
                            <button
                              key={time}
                              type="button"
                              onClick={() => updateLocalSchedule(index, day, time)}
                              className={`${styles.timeSlot} ${endereco.horariosDisponibilidade?.[day]?.includes(time)
                                ? styles.selected
                                : ""
                                }`}
                            >
                              {time}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>

                </div>
              </div>
            ))}
          </div>

          <button className={styles.addLocationButton} onClick={() => setShowAddModal(true)}>
            <Plus size={20} />
            <span>Adicionar Nova Localização</span>
          </button>
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

      {/* Add Location Modal */}
      {showAddModal && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalContent}>
            <div className={styles.modalHeader}>
              <h3 className={styles.modalTitle}>Adicionar Novo Local</h3>
              <button className={styles.closeButton} onClick={() => setShowAddModal(false)}>
                <X size={24} />
              </button>
            </div>

            <div className={styles.formGrid}>
              <div className={styles.formGroup} style={{ gridColumn: '1 / -1' }}>
                <label className={styles.label}>Nome da Clínica (Opcional)</label>
                <input
                  type="text"
                  className={styles.input}
                  value={newLocation.nomeClinica || ""}
                  onChange={(e) => setNewLocation({ ...newLocation, nomeClinica: e.target.value })}
                  placeholder="Ex: Clínica PetLove"
                />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.label}>CEP</label>
                <input
                  type="text"
                  className={styles.input}
                  value={newLocation.cep || ""}
                  onChange={(e) => setNewLocation({ ...newLocation, cep: e.target.value })}
                  placeholder="00000-000"
                />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.label}>Cidade</label>
                <input
                  type="text"
                  className={styles.input}
                  value={newLocation.cidade || ""}
                  onChange={(e) => setNewLocation({ ...newLocation, cidade: e.target.value })}
                />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.label}>Estado</label>
                <input
                  type="text"
                  className={styles.input}
                  value={newLocation.estado || ""}
                  onChange={(e) => setNewLocation({ ...newLocation, estado: e.target.value })}
                  maxLength={2}
                />
              </div>
              <div className={styles.formGroup} style={{ gridColumn: '1 / -1' }}>
                <label className={styles.label}>Rua</label>
                <input
                  type="text"
                  className={styles.input}
                  value={newLocation.rua || ""}
                  onChange={(e) => setNewLocation({ ...newLocation, rua: e.target.value })}
                />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.label}>Número</label>
                <input
                  type="text"
                  className={styles.input}
                  value={newLocation.numero || ""}
                  onChange={(e) => setNewLocation({ ...newLocation, numero: e.target.value })}
                />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.label}>Bairro</label>
                <input
                  type="text"
                  className={styles.input}
                  value={newLocation.bairro || ""}
                  onChange={(e) => setNewLocation({ ...newLocation, bairro: e.target.value })}
                />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.label}>Complemento</label>
                <input
                  type="text"
                  className={styles.input}
                  value={newLocation.complemento || ""}
                  onChange={(e) => setNewLocation({ ...newLocation, complemento: e.target.value })}
                />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.label}>Valor da Consulta</label>
                <div className={styles.priceInputContainer}>
                  <span className={styles.currencyPrefix}>R$</span>
                  <input
                    type="text"
                    className={`${styles.input} ${styles.priceInput}`}
                    value={newLocation.precoConsulta || ''}
                    onChange={(e) => {
                      const value = e.target.value.replace(/[^0-9]/g, '');
                      setNewLocation({ ...newLocation, precoConsulta: value === '' ? 0 : Number(value) });
                    }}
                    placeholder="0"
                  />
                </div>
              </div>
            </div>

            <div className={styles.modalActions}>
              <button className={styles.cancelButton} onClick={() => setShowAddModal(false)}>
                Cancelar
              </button>
              <button
                className={styles.submitButton}
                onClick={handleAddNewLocation}
                disabled={isSaving}
              >
                {isSaving ? "Adicionando..." : "Adicionar Local"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toast && <Toast message={toast.message} type={toast.type} />}
    </div>
  );
}
