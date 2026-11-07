"use client";

import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import { urlDeLogin } from "@/lib/destino-login";
import { CustomCheckbox } from "@/components/ui/CustomCheckbox/CustomCheckbox";
import { Check } from "lucide-react";
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
import { type ErrorState } from "@/utils/errorHandler";
import { mensagemDeErro } from "@/lib/erros";
import styles from "./clinica-onboarding.module.css";
import ProfileImageUploader from "@/components/ProfileImageUploader/ProfileImageUploader";
import GradeSemanalEditor from "@/components/GradeHorarios/GradeSemanalEditor";
import { exemploCategoriasPlano, incluirPlanosVinculados } from "@/lib/planos-saude";
import { AREAS_DE_EXAMES, comodidadeDeCentroDeExames, PERFIS_ATENDIMENTO, perfilAtendimentoValido, type PerfilAtendimento } from "@/lib/perfil-atendimento";

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

const etapasDeExames: OnboardingStep[] = [
  { title: "Bem-vindo ao Lince Pet!", description: "Configure seu centro de exames ou laboratório." },
  { title: "Áreas de exames", description: "Informe as áreas em que seu centro atua." },
  { title: "Estrutura do local", description: "Informe o que os tutores encontram no local." },
  { title: "Horários de atendimento", description: "Quando você recebe pets para exames e coletas?" },
  { title: "Perfil do centro de exames", description: "Adicione a foto e descreva os serviços." },
  { title: "Convênios para exames", description: "Informe quais planos pet são aceitos para exames." },
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
const DIAS_KEYS = Object.keys(DIAS_SEMANA_MAP);
const DIAS_NOMES = DIAS_KEYS.map((d) => DIAS_SEMANA_MAP[d]);

export default function ClinicaOnboardingPage() {
  const { user, loading, updateUser } = useAuth();
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingInitial, setIsLoadingInitial] = useState(true);
  const [especialidades, setEspecialidades] = useState<Especialidade[]>([]);
  const [perfilSalvo, setPerfilSalvo] = useState<PerfilAtendimento | null>(null);
  const [perfilEscolhido, setPerfilEscolhido] = useState<PerfilAtendimento | "">("");
  const [error, setError] = useState<ErrorState | null>(null);
  const [erroAoCarregar, setErroAoCarregar] = useState(false);
  const centroDeExames = perfilEscolhido === "exames";
  const etapas = centroDeExames ? etapasDeExames : onboardingSteps;
  const areasDisponiveis = centroDeExames
    ? especialidades.filter(({ nome }) => AREAS_DE_EXAMES.includes(nome))
    : especialidades;
  const comodidadesDisponiveis = centroDeExames
    ? COMODIDADES_LIST.filter(({ key }) => comodidadeDeCentroDeExames(key))
    : COMODIDADES_LIST;

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
  const [categoriasPorPlano, setCategoriasPorPlano] = useState<Record<string, string>>({});

  const hasFetched = useRef(false);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.push(urlDeLogin());
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
        const [espResponse, progress, plansResponse] = await Promise.all([
          getEspecialidades(), getClinicaOnboardingProgress(), getPlanos(),
        ]);
        if (!espResponse.success || !progress.clinica) throw new Error("Dados de cadastro indisponíveis.");
        setEspecialidades(espResponse.data);
        if (plansResponse) {
          setAvailablePlans(plansResponse);
        }

        const clinica = progress.clinica;
        if (clinica) {
          if (perfilAtendimentoValido(clinica.perfilAtendimento)) {
            setPerfilSalvo(clinica.perfilAtendimento);
            setPerfilEscolhido(clinica.perfilAtendimento);
          }
          if (progress.currentStep > 1) {
            setCurrentStep(clinica.perfilAtendimento ? Math.min(progress.currentStep, 5) : 1);
          }
          if (clinica.especialidades) {
            setSelectedEspecialidades(clinica.especialidades.map((e: { id: string }) => e.id));
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
          if (clinica.planos) {
            const planos = clinica.planos as { id: string; name?: string; categoriasAceitas?: string | null }[];
            setSelectedPlans(planos.map((p) => p.id));
            setCategoriasPorPlano(
              Object.fromEntries(planos.map((p) => [p.id, p.categoriasAceitas?.trim() || ""]))
            );
            setAvailablePlans((ativos) => incluirPlanosVinculados(ativos, planos));
          }
        }

        setIsLoadingInitial(false);
      } catch (err) {
        console.error("Error loading onboarding:", err);
        setErroAoCarregar(true);
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
        case 1: {
          if (!perfilEscolhido) throw new Error("Selecione o tipo de estabelecimento.");
          const areasSelecionadas = centroDeExames
            ? areasDisponiveis.filter(({ id }) => selectedEspecialidades.includes(id)).map(({ id }) => id)
            : selectedEspecialidades;
          if (!centroDeExames && areasSelecionadas.length === 0) {
            throw new Error("Selecione pelo menos uma especialidade.");
          }
          await submitClinicaOnboardingStep1({
            especialidades: areasSelecionadas,
            perfilAtendimento: perfilSalvo ? undefined : perfilEscolhido,
          });
          setPerfilSalvo(perfilEscolhido);
          setSelectedEspecialidades(areasSelecionadas);
          break;
        }
        case 2: {
          const comodidades = centroDeExames
            ? Object.fromEntries(Object.entries(selectedComodidades).filter(([key]) => comodidadeDeCentroDeExames(key)))
            : selectedComodidades;
          await submitClinicaOnboardingStep2({ comodidades });
          break;
        }
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
          await submitClinicaOnboardingStep5({
            planos: selectedPlans.map((id) => ({
              id,
              categoriasAceitas: categoriasPorPlano[id]?.trim() || null,
            })),
          });
          await completeClinicaOnboarding();
          updateUser({ onboardingComplete: 1 });
          router.push(centroDeExames ? "/dashboard/clinica/exames" : "/dashboard/clinica");
          return;
      }

      setCurrentStep(prev => prev + 1);
    } catch (err) {
      setError({ message: mensagemDeErro(err, "Erro ao salvar etapa.") });
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
  if (erroAoCarregar) {
    return (
      <div className={styles.loadingContainer}>
        <p>Não foi possível carregar os dados do cadastro.</p>
        <button className={styles.primaryButton} onClick={() => window.location.reload()}>Tentar novamente</button>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {/* Header / Sidebar reuse from styles if possible, otherwise simple layout */}
      <div className={styles.sidebar}>

        <div className={styles.stepsContainer}>
          {etapas.map((step, index) => (
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
              <p>{centroDeExames
                ? "Vamos preparar o perfil do seu centro de exames ou laboratório. Depois, você poderá configurar os exames, a agenda e o responsável técnico no painel de Exames."
                : "Vamos configurar o perfil do seu estabelecimento em poucos passos."}</p>
              <button className={styles.primaryButton} onClick={handleNext}>Começar</button>
            </div>
          )}

          {currentStep === 1 && (
            <div className={styles.stepContainer}>
              {!perfilSalvo && (
                <div className={styles.formGroup}>
                  <label htmlFor="perfilAtendimento">Tipo de estabelecimento</label>
                  <select id="perfilAtendimento" className={styles.textarea} value={perfilEscolhido}
                    onChange={(e) => {
                      const valor = e.target.value;
                      if (perfilAtendimentoValido(valor)) setPerfilEscolhido(valor);
                    }}>
                    <option value="" disabled>Selecione o tipo de estabelecimento</option>
                    {PERFIS_ATENDIMENTO.map(({ value, label }) => <option key={value} value={value}>{label}</option>)}
                  </select>
                </div>
              )}
              {perfilEscolhido && (
                <>
                  <h2>{etapas[1].title}</h2>
                  <p>{centroDeExames
                    ? "Marque as áreas em que você atua. Exames individuais, como ultrassom ou hemograma, são cadastrados depois no catálogo do painel de Exames."
                    : "Selecione todas as especialidades atendidas na clínica."}</p>

                  <div className={styles.optionsGrid}>
                    {areasDisponiveis.map((esp) => {
                      const selecionada = selectedEspecialidades.includes(esp.id);
                      return (
                        <button type="button" key={esp.id} aria-pressed={selecionada}
                          className={`${styles.optionCard} ${selecionada ? styles.selected : ""}`}
                          onClick={() => setSelectedEspecialidades(prev =>
                            prev.includes(esp.id) ? prev.filter(id => id !== esp.id) : [...prev, esp.id]
                          )}
                        >
                          <span className={styles.optionLabel}>{esp.nome}</span>
                          {selecionada && <Check size={18} className={styles.checkIcon} />}
                        </button>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          )}

          {currentStep === 2 && (
            <div className={styles.stepContainer}>
              <h2>{etapas[2].title}</h2>
              <p>{centroDeExames
                ? "Marque as facilidades disponíveis para os tutores no local de exames e coletas."
                : "Marque o que sua clínica oferece para melhor experiência dos clientes."}</p>

              <div className={styles.checklistGrid}>
                {comodidadesDisponiveis.map((item) => (
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
              <h2>{etapas[3].title}</h2>
              <p>{centroDeExames
                ? "Informe quando você recebe pets para exames e coletas. Marque blocos, um intervalo ou atendimento 24h."
                : "Marque bloco a bloco, um intervalo (das/até) ou aberto 24h, inclusive todos os dias de uma vez para clínicas 24h."}</p>
              <GradeSemanalEditor
                value={horariosFuncionamento}
                dias={DIAS_KEYS}
                nomes={DIAS_NOMES}
                disabled={isLoading}
                onChange={setHorariosFuncionamento}
              />
            </div>
          )}

          {currentStep === 4 && (
            <div className={styles.stepContainer}>
              <h2>{etapas[4].title}</h2>

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
                <label htmlFor="descricao">{centroDeExames ? "Sobre o centro de exames" : "Sobre a clínica"}</label>
                <textarea
                  id="descricao"
                  className={styles.textarea}
                  rows={5}
                  placeholder={centroDeExames
                    ? "Descreva os serviços, as espécies atendidas e como funcionam os exames e as coletas."
                    : "Descreva a história, missão e valores da clínica..."}
                  value={descricao}
                  onChange={(e) => setDescricao(e.target.value)}
                />
              </div>
            </div>
          )}

          {currentStep === 5 && (
            <div className={styles.stepContainer}>
              <h2>{etapas[5].title}</h2>
              <p>{centroDeExames
                ? "Selecione os convênios aceitos para exames e informe as categorias de cada um. Se atende somente particular, deixe em branco."
                : "Selecione os planos e informe as categorias que a clínica aceita em cada um. Cada clínica aceita faixas diferentes do mesmo plano."}</p>

              <div className={styles.optionsGrid}>
                {availablePlans.map((plan) => {
                  const selecionado = selectedPlans.includes(plan.id);
                  return (
                    <div key={plan.id} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      <div
                        className={`${styles.optionCard} ${selecionado ? styles.selected : ""}`}
                        onClick={() => {
                          if (selecionado) {
                            setSelectedPlans((prev) => prev.filter((id) => id !== plan.id));
                            setCategoriasPorPlano((prev) => {
                              const next = { ...prev };
                              delete next[plan.id];
                              return next;
                            });
                          } else {
                            setSelectedPlans((prev) => [...prev, plan.id]);
                          }
                        }}
                      >
                        <span className={styles.optionLabel}>{plan.name}</span>
                        {selecionado ? <Check size={18} className={styles.checkIcon} /> : null}
                      </div>
                      {selecionado ? (
                        <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 13 }}>
                          <span style={{ color: "#64748b", fontWeight: 500 }}>Categorias aceitas</span>
                          <input
                            type="text"
                            value={categoriasPorPlano[plan.id] || ""}
                            placeholder={exemploCategoriasPlano(plan.name)}
                            maxLength={500}
                            onClick={(e) => e.stopPropagation()}
                            onChange={(e) =>
                              setCategoriasPorPlano((prev) => ({ ...prev, [plan.id]: e.target.value }))
                            }
                            style={{
                              width: "100%",
                              border: "1px solid #cbd5e1",
                              borderRadius: 8,
                              padding: "8px 10px",
                              fontSize: 14,
                            }}
                          />
                          <span style={{ color: "#94a3b8", fontSize: 12 }}>{exemploCategoriasPlano(plan.name)}</span>
                        </label>
                      ) : null}
                    </div>
                  );
                })}
              </div>
              {centroDeExames && (
                <p className="mt-4">Ao concluir, você vai para o painel de Exames. Para publicar a agenda, é necessário um plano com exames e a aprovação do responsável técnico.</p>
              )}
            </div>
          )}

          {error && <div className={styles.errorMessage}>{error.message}</div>}

          {currentStep > 0 && (
            <div className={styles.actionButtons}>
              <button className={styles.secondaryButton} onClick={handleBack} disabled={isLoading}>
                Voltar
              </button>
              <button className={styles.primaryButton} onClick={handleNext} disabled={isLoading}>
                {isLoading ? "Salvando..." : (currentStep === 5 ? centroDeExames ? "Ir para o painel de Exames" : "Concluir" : "Continuar")}
              </button>
            </div>
          )}
        </div>
      </div>
    </div >
  );
}
