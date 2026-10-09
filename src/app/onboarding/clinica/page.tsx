"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import { CustomCheckbox } from "@/components/ui/CustomCheckbox/CustomCheckbox";
import { Check, Clock, Upload } from "lucide-react";
import {
  getClinicaOnboardingProgress,
  submitClinicaOnboardingStep1,
  submitClinicaOnboardingStep2,
  submitClinicaOnboardingStep3,
  submitClinicaOnboardingStep4,
  submitClinicaOnboardingStep5,
  completeClinicaOnboarding,
} from "@/services/clinicas/clinicas";
import { getEspecialidades, getPlanos } from "@/services/veterinarios/veterinarios";
import { handleApiError, type ErrorState } from "@/utils/errorHandler";
import styles from "./clinica-onboarding.module.css";
import ProfileImageUploader from "@/components/ProfileImageUploader/ProfileImageUploader";

interface Especialidade {
  id: string;
  nome: string;
}

interface OnboardingStep {
  title: string;
  description: string;
}

const onboardingSteps: OnboardingStep[] = [
  {
    title: "Bem-vindo ao Lince Pet!",
    description: "Vamos configurar o perfil da sua clínica.",
  },
  {
    title: "Especialidades",
    description: "Quais especialidades sua clínica atende?",
  },
  {
    title: "Comodidades",
    description: "O que sua clínica oferece aos clientes?",
  },
  {
    title: "Horário de Funcionamento",
    description: "Defina os horários de atendimento.",
  },
  {
    title: "Perfil da Clínica",
    description: "Adicione uma foto e descrição.",
  },
  {
    title: "Planos de Saúde",
    description: "Quais planos sua clínica aceita?",
  },
];

const COMODIDADES_LIST = [
  { key: "estacionamento", label: "Estacionamento Próprio" },
  { key: "acessibilidade", label: "Acessibilidade (Rampa/Elevador)" },
  { key: "arcondicionado", label: "Ar Condicionado" },
  { key: "wifi", label: "Wi-Fi Gratuito" },
  { key: "salaespera", label: "Sala de Espera Confortável" },
  { key: "banheiro", label: "Banheiro para Clientes" },
  { key: "atendimento24h", label: "Atendimento 24h" },
  { key: "farmacia", label: "Farmácia Veterinária" },
  { key: "internacao", label: "Internação" },
  { key: "raiox", label: "Raio-X / Ultrassom" },
];

const DIAS_SEMANA_MAP: { [key: string]: string } = {
  segunda: "Segunda-feira",
  terca: "Terça-feira",
  quarta: "Quarta-feira",
  quinta: "Quinta-feira",
  sexta: "Sexta-feira",
  sabado: "Sábado",
  domingo: "Domingo",
};

export default function ClinicaOnboardingPage() {
  const { user, loading, updateUser } = useAuth();
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingInitial, setIsLoadingInitial] = useState(true);
  const [especialidades, setEspecialidades] = useState<Especialidade[]>([]);
  const [error, setError] = useState<ErrorState | null>(null);

  // Form Data
  const [selectedEspecialidades, setSelectedEspecialidades] = useState<string[]>([]);
  const [selectedComodidades, setSelectedComodidades] = useState<Record<string, boolean>>({});
  const [horariosFuncionamento, setHorariosFuncionamento] = useState<{ [key: string]: string[] }>({
    segunda: [],
    terca: [],
    quarta: [],
    quinta: [],
    sexta: [],
    sabado: [],
    domingo: [],
  });
  const [descricao, setDescricao] = useState("");
  const [selectedPhoto, setSelectedPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [availablePlans, setAvailablePlans] = useState<{ id: string; name: string }[]>([]);
  const [selectedPlans, setSelectedPlans] = useState<string[]>([]);

  // Helper: Generate Time Slots
  const generateTimeSlots = () => {
    const slots = [];
    for (let hour = 8; hour <= 23; hour++) {
      slots.push(`${hour.toString().padStart(2, "0")}:00`);
      if (hour < 23) {
        slots.push(`${hour.toString().padStart(2, "0")}:30`);
      }
    }
    slots.push("23:30");
    return slots;
  };

  const handleTimeToggle = (day: string, time: string) => {
    setHorariosFuncionamento((prev) => ({
      ...prev,
      [day]: prev[day].includes(time)
        ? prev[day].filter((t) => t !== time)
        : [...prev[day], time].sort(),
    }));
  };

  const hasFetched = useRef(false);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.push("/login");
      return;
    }
    if (user.userType !== "clinica") {
      router.push("/");
      return;
    }
    if (hasFetched.current) return;

    const loadData = async () => {
      try {
        hasFetched.current = true;
        setIsLoadingInitial(true);
        // Load Specialties
        const espResponse = await getEspecialidades();
        if (espResponse.success) {
          setEspecialidades(espResponse.data);
        }

        // Load Progress
        const progress = await getClinicaOnboardingProgress();
        if (progress.currentStep > 1) {
          const validCurrentStep = Math.min(Math.max(progress.currentStep, 0), 5);
          setCurrentStep(validCurrentStep);
        }

        // Load Plans
        const plansResponse = await getPlanos();
        if (plansResponse) {
          setAvailablePlans(plansResponse);
        }

        // Populate Data if exists
        const clinica = progress.clinica;
        if (clinica) {
          if (clinica.especialidades) {
            setSelectedEspecialidades(clinica.especialidades.map((e: any) => e.id));
          }
          if (clinica.comodidades) {
            // Handle if it comes as string or object
            const comodidadesObj = typeof clinica.comodidades === 'string' ? JSON.parse(clinica.comodidades) : clinica.comodidades;
            setSelectedComodidades(comodidadesObj || {});
          }
          if (clinica.horariosFuncionamento) {
            const horariosObj = typeof clinica.horariosFuncionamento === 'string' ? JSON.parse(clinica.horariosFuncionamento) : clinica.horariosFuncionamento;
            setHorariosFuncionamento(horariosObj || { segunda: [], terca: [], quarta: [], quinta: [], sexta: [], sabado: [], domingo: [] });
          }
          if (clinica.descricao || clinica.sobre) setDescricao(clinica.descricao || clinica.sobre || "");
          if (clinica.fotoPerfil) setPhotoPreview(clinica.fotoPerfil);
          if (clinica.planos) setSelectedPlans(clinica.planos.map((p: any) => p.id));
        }

        setIsLoadingInitial(false);
      } catch (err) {
        console.error("Error loading onboarding:", err);
        setIsLoadingInitial(false);
      }
    };

    loadData();
  }, [user, loading, router]);

  const handleNext = async () => {
    if (currentStep === 0) {
      setCurrentStep(1);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      switch (currentStep) {
        case 1:
          if (selectedEspecialidades.length === 0) {
            throw new Error("Selecione pelo menos uma especialidade.");
          }
          await submitClinicaOnboardingStep1({ especialidades: selectedEspecialidades });
          break;
        case 2:
          await submitClinicaOnboardingStep2({ comodidades: selectedComodidades });
          break;
        case 3:
          const hasHours = Object.values(horariosFuncionamento).some(day => day.length > 0);
          if (!hasHours) throw new Error("Defina horário para pelo menos um dia.");
          await submitClinicaOnboardingStep3({ horariosFuncionamento });
          break;
        case 4:
          if (!descricao) throw new Error("A descrição é obrigatória.");
          const resultStep4 = await submitClinicaOnboardingStep4({ descricao }, selectedPhoto || undefined);
          if (resultStep4.fotoUrl) {
            updateUser({ fotoUrl: resultStep4.fotoUrl });
          }
          break;
        case 5:
          await submitClinicaOnboardingStep5({ planos: selectedPlans });
          await completeClinicaOnboarding();
          updateUser({ onboardingComplete: 1 });
          router.push("/dashboard/clinica");
          return;
      }

      setCurrentStep(prev => prev + 1);
    } catch (err: any) {
      setError({ message: err.message || "Erro ao salvar etapa." });
    } finally {
      setIsLoading(false);
    }
  };

  const handleBack = () => {
    if (currentStep > 0) setCurrentStep(prev => prev - 1);
  };

  if (isLoadingInitial) {
    return (
      <div className={styles.loadingContainer}>
        <div className={styles.spinner}></div>
        <p>Carregando...</p>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {/* Header / Sidebar reuse from styles if possible, otherwise simple layout */}
      <div className={styles.sidebar}>

        <div className={styles.stepsContainer}>
          {onboardingSteps.map((step, index) => (
            <div key={index} className={`${styles.stepItem} ${index <= currentStep ? styles.activeStep : ""} ${index < currentStep ? styles.completedStep : ""}`}>
              <div className={styles.stepIndicator}>
                {index < currentStep ? <Check size={16} /> : index + 1}
              </div>
              <div className={styles.stepContent}>
                <span className={styles.stepTitle}>{step.title}</span>
                <span className={styles.stepDescription}>{step.description}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className={styles.mainContent}>
        <div className={styles.contentWrapper}>
          {currentStep === 0 && (
            <div className={styles.welcomeContainer}>
              <h1>Bem-vindo ao Lince Pet!</h1>
              <p>Estamos muito felizes em ter sua clínica conosco. Vamos configurar seu perfil em poucos passos.</p>
              <button className={styles.primaryButton} onClick={handleNext}>Começar</button>
            </div>
          )}

          {currentStep === 1 && (
            <div className={styles.stepContainer}>
              <h2>Especialidades</h2>
              <p>Selecione todas as especialidades atendidas na clínica.</p>

              <div className={styles.optionsGrid}>
                {especialidades.map((esp) => (
                  <div key={esp.id}
                    className={`${styles.optionCard} ${selectedEspecialidades.includes(esp.id) ? styles.selected : ""}`}
                    onClick={() => {
                      if (selectedEspecialidades.includes(esp.id)) {
                        setSelectedEspecialidades(prev => prev.filter(id => id !== esp.id));
                      } else {
                        setSelectedEspecialidades(prev => [...prev, esp.id]);
                      }
                    }}
                  >
                    <span className={styles.optionLabel}>{esp.nome}</span>
                    {selectedEspecialidades.includes(esp.id) && <Check size={18} className={styles.checkIcon} />}
                  </div>
                ))}
              </div>
            </div>
          )}

          {currentStep === 2 && (
            <div className={styles.stepContainer}>
              <h2>Comodidades</h2>
              <p>Marque o que sua clínica oferece para melhor experiência dos clientes.</p>

              <div className={styles.checklistGrid}>
                {COMODIDADES_LIST.map((item) => (
                  <div key={item.key} className={styles.checklistItem}>
                    <CustomCheckbox
                      label={item.label}
                      checked={!!selectedComodidades[item.key]}
                      onChange={(checked) => setSelectedComodidades(prev => ({ ...prev, [item.key]: checked }))}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {currentStep === 3 && (
            <div className={styles.stepContainer}>
              <h2>Horário de Funcionamento</h2>
              <p>Selecione os horários de atendimento para cada dia da semana.</p>

              <div className={styles.scheduleGrid}>
                {Object.keys(DIAS_SEMANA_MAP).map((day) => (
                  <div key={day} className={styles.daySchedule}>
                    <h3 className={styles.dayTitle}>{DIAS_SEMANA_MAP[day]}</h3>
                    <div className={styles.timeSlots}>
                      {generateTimeSlots().map((time) => (
                        <button
                          key={`${day}-${time}`}
                          type="button"
                          className={`${styles.timeSlot} ${horariosFuncionamento[day].includes(time) ? styles.selectedTime : ""}`}
                          onClick={() => handleTimeToggle(day, time)}
                        >
                          {time}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {currentStep === 4 && (
            <div className={styles.stepContainer}>
              <h2>Perfil da Clínica</h2>

              <div className={styles.formGroup2}>
                <label>Foto de Perfil / Logo</label>
                <div className={styles.profileImageContainer}>

                  <ProfileImageUploader
                    currentImageUrl={photoPreview}
                    userName={user?.nome || "Clínica"}
                    onUpload={async (file) => {
                      setSelectedPhoto(file);
                      setPhotoPreview(URL.createObjectURL(file));
                    }}
                    cropShape="circle"
                  />
                </div>
              </div>
              <div className={styles.formGroup}>
                <label>Sobre a Clínica</label>
                <textarea
                  className={styles.textarea}
                  rows={5}
                  placeholder="Descreva a história, missão e valores da clínica..."
                  value={descricao}
                  onChange={(e) => setDescricao(e.target.value)}
                />
              </div>
            </div>
          )}

          {currentStep === 5 && (
            <div className={styles.stepContainer}>
              <h2>Planos de Saúde</h2>
              <p>Selecione todos os planos de saúde que sua clínica aceita.</p>

              <div className={styles.optionsGrid}>
                {availablePlans.map((plan) => (
                  <div key={plan.id}
                    className={`${styles.optionCard} ${selectedPlans.includes(plan.id) ? styles.selected : ""}`}
                    onClick={() => {
                      if (selectedPlans.includes(plan.id)) {
                        setSelectedPlans(prev => prev.filter(id => id !== plan.id));
                      } else {
                        setSelectedPlans(prev => [...prev, plan.id]);
                      }
                    }}
                  >
                    <span className={styles.optionLabel}>{plan.name}</span>
                    {selectedPlans.includes(plan.id) && <Check size={18} className={styles.checkIcon} />}
                  </div>
                ))}
              </div>
            </div>
          )}

          {error && <div className={styles.errorMessage}>{error.message}</div>}

          {currentStep > 0 && (
            <div className={styles.actionButtons}>
              <button className={styles.secondaryButton} onClick={handleBack} disabled={isLoading}>
                Voltar
              </button>
              <button className={styles.primaryButton} onClick={handleNext} disabled={isLoading}>
                {isLoading ? "Salvando..." : (currentStep === 5 ? "Concluir" : "Continuar")}
              </button>
            </div>
          )}
        </div>
      </div>
    </div >
  );
}
