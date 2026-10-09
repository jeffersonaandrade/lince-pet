"use client";

import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect, useState, useMemo, useRef, useCallback } from "react";
import {
  getOnboardingProgress,
  uploadProfilePhoto,
} from "@/services/veterinarios/veterinarios";
import { VeterinarioDashboardService } from "@/services/veterinarios/dashboard";
import CustomCalendar from "@/components/CustomCalendar/CustomCalendar";
import moment from "moment";
import "moment/locale/pt-br";
import styles from "./veterinario.module.css";
import { AvaliacoesService } from "@/services/avaliacoes/avaliacoes";
import { AssinaturasService } from "@/services/assinaturas/assinaturas";
import Link from "next/link";
import ShareProfileButton from "@/components/ShareProfileButton/ShareProfileButton";
import ProfileImageUploader from "@/components/ProfileImageUploader/ProfileImageUploader";
import Image from "next/image";
import { formatDateToISO } from "@/utils/formatters";
import LottieLoading from "@/components/ui/LottieLoading/LottieLoading";
import { Dog, Tag, Maximize2, MapPin, CreditCard, MessageCircle, Calendar as CalendarIcon, Camera, Info, TrendingUp, Clock, Star, Crown } from "lucide-react";






// Configurar moment para português
moment.locale("pt-br");

// Novos componentes de ícone para melhor visual nos detalhes
const UserIcon = ({ size = 18, className = "" }: { size?: number; className?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </svg>
);

const PawIcon = ({ size = 14, className = "" }: { size?: number; className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24"><path fill="#e67e22" d="M9.5 22q-1.475 0-2.488-1.012T6 18.5q0-.225.063-.35t-.013-.2t-.2-.012T5.5 18q-1.475 0-2.488-1.012T2 14.5t1.013-2.488T5.5 11q.575 0 1.05.15t.9.45l4.15-4.15q-.3-.425-.45-.9T11 5.5q0-1.475 1.013-2.488T14.5 2t2.488 1.013T18 5.5q0 .225-.062.35t.012.2t.2.013T18.5 6q1.475 0 2.488 1.013T22 9.5t-1.012 2.488T18.5 13q-.575 0-1.05-.15t-.9-.45l-4.15 4.15q.3.425.45.9T13 18.5q0 1.475-1.012 2.488T9.5 22m0-2q.65 0 1.075-.425T11 18.5q0-.225-.062-.437t-.188-.413q-.425-.6-.35-1.287t.6-1.213L15.15 11q.525-.525 1.213-.6t1.287.35q.2.125.413.188T18.5 11q.65 0 1.075-.425T20 9.5t-.425-1.075T18.5 8q-.875 0-1.225-.088t-.725-.462t-.462-.725T16 5.5q0-.65-.425-1.075T14.5 4t-1.075.425T13 5.5q0 .275.05.463t.2.387q.425.6.35 1.288T13 8.85L8.85 13q-.525.525-1.213.6t-1.287-.35q-.2-.125-.412-.187T5.5 13q-.65 0-1.075.425T4 14.5t.425 1.075T5.5 16q.875 0 1.225.088t.725.462t.462.725T8 18.5q0 .65.425 1.075T9.5 20m2.5-8" /></svg>
);

// Interface para os eventos do calendário
interface CalendarEvent {
  id: number;
  title: string;
  start: Date;
  end: Date;
  resource?: {
    cliente: string;
    clienteSobrenome?: string;
    pet: string;
    petRaca?: string;
    petPorte?: string;
    petEspecie?: string;
    tipo: string;
    status?: string;
    observacoes?: string;
    localNome?: string;
    localEndereco?: string;
    valor?: number;
    horario?: string;
    petFotoUrl?: string;
  };
}



interface ProximaConsulta {
  id: number;
  observacoes?: string;
  cliente: string;
  clienteSobrenome?: string;
  pet: string;
  petEspecie?: string;
  petRaca?: string;
  petPorte?: string;
  horario: string;
  tipo: string;
  status?: string;
  localNome?: string;
  localEndereco?: string;
  valor?: number;
  petFotoUrl?: string;
}

interface DashboardData {
  agendamentosHoje: number;
  agendamentosSemana: number;
  agendamentosMes: number;
  totalClientes: number;
  proximasConsultas: ProximaConsulta[];
}

// Tipos auxiliares para dados de onboarding (evita uso de any)
type VetEndereco = {
  id?: number | string;
  cidade?: string;
  estado?: string;
  isPrimary?: boolean;
  rua?: string;
  numero?: string;
  bairro?: string;
  cep?: string;
  complemento?: string;
  nomeClinica?: string;
  fotoUrl?: string; // Caso tenha esse campo vindo do backend
  precoConsulta?: number; // Preço da consulta no local
};


type VetEspecialidade = { nome?: string };
type VeterinarioLite = {
  id?: number | string;
  bio?: string | null;
  especialidades?: VetEspecialidade[];
  enderecos?: VetEndereco[];
  creditos?: number | null;
  planos?: Array<{
    id?: number;
    code?: string;
    name?: string;
    image?: string | null;
    status?: string;
    isActive?: boolean;
    createdAt?: string;
  }>;
};

type OnboardingData = {
  currentStep?: number;
  veterinario?: VeterinarioLite;
};

type OnboardingResponse =
  | OnboardingData
  | { success?: boolean; data?: OnboardingData };

function unwrapOnboarding(input: unknown): OnboardingData {
  if (
    typeof input === "object" &&
    input !== null &&
    "data" in (input as Record<string, unknown>)
  ) {
    const maybe = (input as { data?: unknown }).data;
    if (typeof maybe === "object" && maybe !== null)
      return maybe as OnboardingData;
  }
  return (input as OnboardingData) || {};
}

export default function VeterinarioDashboard() {
  const { user, loading, updateUser } = useAuth();
  const router = useRouter();
  const [isLoadingOnboarding, setIsLoadingOnboarding] = useState(true);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [isLoadingConsultas, setIsLoadingConsultas] = useState(false);
  const [view, setView] = useState<'month' | 'week' | 'day'>("month");
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(
    null
  );
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isConcluding, setIsConcluding] = useState(false);
  const [isCodeModalOpen, setIsCodeModalOpen] = useState(false);
  const [startCode, setStartCode] = useState("");
  const [isStarting, setIsStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [recentComments, setRecentComments] = useState<
    Array<{
      id: string | number;
      estrelas: number;
      comentario?: string | null;
      data?: string | null;
      hora?: string | null;
      tutor?: { nome: string; sobrenome?: string | null } | null;
      pet?: { nome: string; foto_url?: string | null } | null;
    }>
  >([]);
  const [vetEnderecos, setVetEnderecos] = useState<VetEndereco[]>([]);

  // Informações do perfil do veterinário para o topo
  const [vetId, setVetId] = useState<number | string | null>(null);
  const [vetBio, setVetBio] = useState<string | null>(null);
  const [vetEspecialidades, setVetEspecialidades] = useState<string[]>([]);
  const [vetLocal, setVetLocal] = useState<string | null>(null);
  const [subscriptionUsage, setSubscriptionUsage] = useState<{ used: number; limit: number | null } | null>(null);
  const [vetPlanoAtual, setVetPlanoAtual] = useState<string | null>(null);
  const [vetPlanoImagem, setVetPlanoImagem] = useState<string | null>(null);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement | null>(null);
  const dateInputRef = useRef<HTMLInputElement | null>(null);

  // Estados para dados reais
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [dashboardData, setDashboardData] = useState<DashboardData>({
    agendamentosHoje: 0,
    agendamentosSemana: 0,
    agendamentosMes: 0,
    totalClientes: 0,
    proximasConsultas: [],
  });

  // Detecta largura de tela para ajustes específicos de mobile
  useEffect(() => {
    const check = () =>
      setIsMobile(typeof window !== "undefined" && window.innerWidth <= 480);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  // Helpers para status: cores e ícones
  const normalizeStatus = (raw?: string | null) =>
    (raw || "")
      .normalize("NFD")
      .replace(/\p{Diacritic}+/gu, "")
      .trim()
      .toLowerCase();

  const statusMeta = (status?: string | null) => {
    const s = normalizeStatus(status);
    if (s === "concluido" || s === "concluida" || s === "realizado")
      return { color: "#16a34a", label: "Concluído", icon: "check" as const };
    if (s === "cancelado" || s === "reagendado")
      return { color: "#b42318", label: "Cancelado", icon: "x" as const };
    if (s === "emandamento" || s === "em andamento")
      return {
        color: "#3730a3",
        label: "Em andamento",
        icon: "progress" as const,
      };
    if (s === "confirmado")
      return {
        color: "#2563eb",
        label: "Confirmado",
        icon: "check-circle" as const,
      };
    if (
      s === "pendente" ||
      s === "aguardando" ||
      s === "aguardanao" ||
      s === "aguardano"
    )
      return { color: "#d97706", label: "Aguardando", icon: "clock" as const };
    return { color: "#e67e22", label: "", icon: "dot" as const };
  };

  const StatusIcon = ({
    kind,
  }: {
    kind: "check" | "x" | "clock" | "progress" | "check-circle" | "dot";
  }) => {
    const common = {
      width: 14,
      height: 14,
      viewBox: "0 0 24 24",
      fill: "currentColor",
    } as const;
    switch (kind) {
      case "check":
        return (
          <svg {...common} aria-hidden>
            <path
              d="M20 6L9 17l-5-5"
              stroke="currentColor"
              strokeWidth="2"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        );
      case "x":
        return (
          <svg {...common} aria-hidden>
            <path
              d="M18 6L6 18M6 6l12 12"
              stroke="currentColor"
              strokeWidth="2"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        );
      case "clock":
        return (
          <svg {...common} aria-hidden>
            <circle
              cx="12"
              cy="12"
              r="9"
              stroke="currentColor"
              strokeWidth="2"
              fill="none"
            />
            <path
              d="M12 7v5l4 2"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        );
      case "progress":
        return (
          <svg {...common} aria-hidden>
            <path
              d="M12 3a9 9 0 109 9"
              stroke="currentColor"
              strokeWidth="2"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        );
      case "check-circle":
        return (
          <svg {...common} aria-hidden>
            <circle
              cx="12"
              cy="12"
              r="9"
              stroke="currentColor"
              strokeWidth="2"
              fill="none"
            />
            <path
              d="M16 10l-4 4-2-2"
              stroke="currentColor"
              strokeWidth="2"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        );
      default:
        return (
          <svg {...common} aria-hidden>
            <circle cx="12" cy="12" r="4" />
          </svg>
        );
    }
  };

  const [currentDate, setCurrentDate] = useState(new Date());

  // ... (other states remain the same)

  // Função para buscar estatísticas (apenas uma vez ou quando necessário)
  const carregarEstatisticas = useCallback(async () => {
    try {
      const estatisticas = await VeterinarioDashboardService.buscarEstatisticas();
      setDashboardData(prev => ({ ...prev, ...estatisticas }));
    } catch (error) {
      console.error("Erro ao carregar estatísticas:", error);
    }
  }, []);

  // Função para buscar eventos do calendário baseados na data atual da visualização
  const carregarEventosCalendario = useCallback(async (date: Date) => {
    try {
      const primeiroDiaMes = new Date(date.getFullYear(), date.getMonth(), 1);
      const ultimoDiaMes = new Date(date.getFullYear(), date.getMonth() + 1, 0);

      const dataInicio = formatDateToISO(primeiroDiaMes);
      const dataFim = formatDateToISO(ultimoDiaMes);

      const eventosCalendario = await VeterinarioDashboardService.buscarAgendamentosCalendario(
        dataInicio,
        dataFim
      );

      setEvents(eventosCalendario);
    } catch (error) {
      console.error("Erro ao carregar eventos do calendário:", error);
    }
  }, []);

  // Carrega consultas para uma data específica (lista lateral)
  const carregarConsultasPorData = useCallback(async (date: Date) => {
    try {
      setIsLoadingConsultas(true);
      const consultas = await VeterinarioDashboardService.buscarProximasConsultas(date);
      setDashboardData((prev) => ({ ...prev, proximasConsultas: consultas }));
    } catch (error) {
      console.error("Erro ao carregar consultas por data:", error);
    } finally {
      setIsLoadingConsultas(false);
    }
  }, []);

  // Carrega dados iniciais
  const carregarDadosIniciais = useCallback(async () => {
    try {
      setIsLoadingData(true);
      await Promise.all([
        carregarEstatisticas(),
        carregarConsultasPorData(selectedDate),
        carregarEventosCalendario(currentDate)
      ]);
    } finally {
      setIsLoadingData(false);
    }
  }, [carregarEstatisticas, carregarConsultasPorData, selectedDate, carregarEventosCalendario, currentDate]);

  // Efeito para recarregar eventos quando o mês do calendário mudar
  useEffect(() => {
    if (!isLoadingData) { // Evita chamada duplicada na inicialização
      carregarEventosCalendario(currentDate);
    }
  }, [currentDate]);



  // Mapeia códigos técnicos de plano para nomes amigáveis
  const friendlyPlanName = (raw: string | null): string => {
    if (!raw || raw === "none" || raw === "free") return "Sem plano";
    const code = String(raw).toLowerCase();
    const withoutPrefix = code.replace(/^vet[_-]/, "");
    const map: Record<string, string> = {
      light: "Vet Light",
      start: "Vet Light",
      pro: "Vet Pro",
      master: "Vet Master",
      expert: "Vet Expert",
      basic: "Veterinário Básico",
      starter: "Veterinário Inicial",
      standard: "Veterinário Padrão",
      plus: "Veterinário Plus",
      premium: "Veterinário Premium",
      advanced: "Veterinário Avançado",
      enterprise: "Veterinário Empresarial",
    };
    if (map[withoutPrefix]) return map[withoutPrefix];
    // Fallback: capitaliza e remove underscores
    const title = withoutPrefix
      .split(/[\W_]+/)
      .filter(Boolean)
      .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
      .join(" ");
    return `Veterinário ${title}`.trim();
  };

  // Mapeia código do plano para o ícone SVG local (public/iconPlans/)
  const planIconPath = (raw: string | null): string | null => {
    if (!raw || raw === "none" || raw === "free") return null;
    const code = String(raw).toLowerCase().replace(/^vet[_-]/, "");
    const iconMap: Record<string, string> = {
      light: "/iconPlans/Plan1.svg",
      start: "/iconPlans/Plan1.svg",
      pro: "/iconPlans/Plan2.svg",
      pro_plus: "/iconPlans/Plan3.svg",
      "pro+": "/iconPlans/Plan3.svg",
    };
    return iconMap[code] || null;
  };

  // Resolve o plano atual a partir do objeto do veterinário
  const resolveCurrentPlan = useCallback((vet?: VeterinarioLite | null): string | null => {
    if (!vet || !Array.isArray(vet.planos) || vet.planos.length === 0)
      return null;
    const arr = vet.planos;
    const isActive = (p?: string) => {
      const v = (p || "").toLowerCase();
      return v === "active" || v === "ativo" || v === "ativa";
    };
    const active = arr.find((p) => p.isActive || isActive(p.status));
    if (active) return active.code || active.name || null;
    // fallback por data de criação, depois por id
    const sorted = [...arr].sort((a, b) => {
      const ad = a.createdAt ? Date.parse(a.createdAt) : 0;
      const bd = b.createdAt ? Date.parse(b.createdAt) : 0;
      if (ad !== bd) return bd - ad; // desc
      const ai = typeof a.id === "number" ? a.id : -1;
      const bi = typeof b.id === "number" ? b.id : -1;
      return bi - ai; // desc
    });
    const first = sorted[0];
    return (first && (first.code || first.name)) || null;

  }, []);

  useEffect(() => {
    if (loading) return;

    if (!user) {
      router.push("/login");
      return;
    }

    if (user.userType !== "veterinario") {
      router.push("/");
      return;
    }

    const checkOnboarding = async () => {

      try {
        const progress = await getOnboardingProgress();
        // O service pode retornar { success, data } ou diretamente os dados
        const progressData = unwrapOnboarding(progress as OnboardingResponse);
        const currentStep = progressData.currentStep ?? 0;

        if (currentStep < 8) {
          router.push("/onboarding");
        } else {
          // Só carrega os dados após verificar onboarding
          await carregarDadosIniciais();
          // Popular os dados de topo: bio, especialidades, local, créditos
          try {
            const vet = progressData.veterinario;
            if (vet) {
              setVetId(vet.id ?? null);
              setVetBio(vet.bio ?? null);
              const esp = Array.isArray(vet.especialidades)
                ? vet.especialidades
                  .map((e) => e?.nome)
                  .filter((n): n is string => Boolean(n))
                : [];
              setVetEspecialidades(esp);
              const primary = Array.isArray(vet.enderecos)
                ? vet.enderecos.find((e) => e?.isPrimary) ?? vet.enderecos[0]
                : undefined;
              if (primary) {
                const loc = [primary.cidade, primary.estado]
                  .filter((p): p is string => Boolean(p))
                  .join(" - ");
                setVetLocal(loc || null);
                if (vet.enderecos && Array.isArray(vet.enderecos)) {
                  setVetEnderecos(vet.enderecos);
                }
              }
              // Plano atual (se vinculado). Procuramos o ativo/mais recente como fallback
              const resolved = resolveCurrentPlan(vet) || null;
              let actualPlan = resolved;

              try {
                const assinaturas = AssinaturasService();
                const statusData = await assinaturas.obterStatus();
                if (statusData?.usage) {
                  setSubscriptionUsage(statusData.usage);
                }
                if (statusData?.plan?.code) {
                  actualPlan = statusData.plan.code;
                  try {
                    window.localStorage.setItem("vetSelectedPlan", statusData.plan.code);
                  } catch (e) { }
                }
              } catch (e) {
                console.warn("Falha ao carregar status da assinatura", e);
                // Fallback to local storage if API fails but we have a stored plan
                try {
                  const localPlan = window.localStorage.getItem("vetSelectedPlan");
                  if (localPlan && localPlan.trim()) {
                    actualPlan = localPlan.trim();
                  }
                } catch { }
              }

              setVetPlanoAtual(actualPlan);

              // Preferir um override local (ex.: troca de plano recém concluída)
              if (vet?.planos && Array.isArray(vet.planos) && vet.planos.length > 0) {
                const isActivePlan = (p?: string) => {
                  const v = (p || "").toLowerCase();
                  return v === "active" || v === "ativo" || v === "ativa";
                };
                const activePlan = vet.planos.find(
                  (p) => p.isActive || isActivePlan(p.status)
                ) || vet.planos[0];
                setVetPlanoImagem(activePlan?.image || null);
              }
            }
          } catch { }
          // Carregar comentários recentes (avaliações)
          try {
            const resp = await AvaliacoesService.listarMinhasRecentes();
            setRecentComments(resp.avaliacoes || []);
          } catch (e) {
            console.warn("Falha ao carregar comentários recentes", e);
          }
        }
      } catch (error) {
        console.error("Error checking onboarding status:", error);
      } finally {
        setIsLoadingOnboarding(false);
      }
    };

    checkOnboarding();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, loading, router]);

  if (loading || isLoadingOnboarding) {
    return (
      <div className={styles.loadingContainer} style={{ minHeight: "100vh", display: "flex", alignItems: "center" }}>
        <LottieLoading />
      </div>
    );
  }

  if (!user || user.userType !== "veterinario") {
    return null;
  }

  if (isLoadingData) {
    return (
      <div className={styles.pageBackground} style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <LottieLoading />
      </div>
    );
  }

  const isHoje = moment(selectedDate).isSame(moment(), "day");
  const labelData = isHoje ? "Hoje" : moment(selectedDate).format("DD/MM/YYYY");

  const alterarDia = (delta: number) => {
    const novaData = moment(selectedDate).add(delta, "day").toDate();
    setSelectedDate(novaData);
    carregarConsultasPorData(novaData);
  };

  const concluirAgendamentoSelecionado = async () => {
    if (!selectedEvent) return;
    try {
      setIsConcluding(true);
      const ok = await VeterinarioDashboardService.concluirAgendamento(
        selectedEvent.id
      );
      if (ok) {
        // Atualiza lista de próximas consultas
        setDashboardData((prev) => ({
          ...prev,
          proximasConsultas: prev.proximasConsultas.map((c) =>
            c.id === selectedEvent.id ? { ...c, status: "realizado" } : c
          ),
        }));
        // Atualiza eventos do calendário in-memory
        setEvents((prev) =>
          prev.map((ev) => {
            if (ev.id !== selectedEvent.id) return ev;
            if (ev.resource) {
              return {
                ...ev,
                resource: { ...ev.resource, status: "realizado" },
              };
            }
            return ev;
          })
        );
        setIsModalOpen(false);
        setSelectedEvent(null);
      }
    } finally {
      setIsConcluding(false);
    }
  };

  return (
    <>
      <div className={styles.coverWrapper}>
        <div className={styles.coverFallback}></div>
      </div>

      <div className={styles.contentWrapper}>
        <section className={styles.headerInfo}>
          <div className={styles.logoWrapper}>
            <ProfileImageUploader
              currentImageUrl={user.fotoUrl}
              userName={user.nome}
              isUploading={isUploadingAvatar}
              onUpload={async (file) => {
                try {
                  setIsUploadingAvatar(true);
                  const res = await uploadProfilePhoto(file);
                  if (res?.url) updateUser({ fotoUrl: res.url });
                } catch (err) {
                  console.error(
                    "Falha ao enviar foto do veterinário:",
                    err
                  );
                  alert("Não foi possível enviar a foto. Tente novamente.");
                } finally {
                  setIsUploadingAvatar(false);
                }
              }}
              className={styles.profileImageUploader}
              borderRadius="12px"
            />
          </div>

          <div className={styles.titleSection}>
            <div className={styles.titleRow}>
              <div className={styles.welcomeText}>
                <h1 style={{ fontSize: '1.8rem', color: 'var(--text-color)', margin: 0, wordBreak: 'break-word', overflowWrap: 'break-word' }}>
                  Olá, Dr(a). {user.nome}!
                </h1>
                <p style={{ color: '#64748b', marginTop: '0.25rem' }}>
                  Bem-vindo ao seu painel de controle
                </p>
                <div className={styles.topInfoChips}>
                  {vetEspecialidades.length > 0 && (
                    <div className={styles.infoChip} title="Especialidades">
                      <span className={styles.chipText}>
                        {vetEspecialidades.slice(0, 3).join(", ")}
                        {vetEspecialidades.length > 3 &&
                          ` +${vetEspecialidades.length - 3}`}
                      </span>
                    </div>
                  )}
                  {vetLocal && (
                    <div
                      className={styles.infoChip}
                      title="Local de atendimento"
                    >
                      <span className={styles.chipText}>{vetLocal}</span>
                    </div>
                  )}
                </div>
                {vetBio && <p className={styles.bioText}>{vetBio}</p>}
              </div>

              {/* Painel à direita com Créditos e Plano atual */}
              <div className={styles.headerRightPanel}>
                {subscriptionUsage && vetPlanoAtual && vetPlanoAtual !== 'none' && vetPlanoAtual !== 'free' && (
                  <div className={styles.metricBox} title="Limites de agendamento">
                    <div className={styles.metricLabel}>Agendamentos (Mensal)</div>
                    <div className={styles.metricValue}>
                      {/* {subscriptionUsage.used} / */}
                       {subscriptionUsage.limit === null ? "∞" : subscriptionUsage.limit}
                    </div>
                  </div>
                )}
                <div className={styles.metricBox} title="Plano atual">
                  <div className={styles.metricLabel}>Plano atual</div>
                  <div className={styles.metricValue} style={{ display: 'flex', alignItems: 'center', gap: '8px', minHeight: '42px' }}>
                    {planIconPath(vetPlanoAtual) && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={planIconPath(vetPlanoAtual)!}
                        alt="Ícone do plano"
                        width={42}
                        height={42}
                        style={{ borderRadius: '6px', objectFit: 'contain', flexShrink: 0 }}
                      />
                    )}
                    <span className={styles.namePlan}> {friendlyPlanName(vetPlanoAtual)} </span>
                  </div>
                  <Link
                    href="/dashboard/veterinario/alterar-plano"
                    className={styles.planLink}
                    style={{
                      color: subscriptionUsage?.limit && subscriptionUsage.used >= subscriptionUsage.limit * 0.8 ? '#dc2626' : undefined,
                      fontWeight: subscriptionUsage?.limit && subscriptionUsage.used >= subscriptionUsage.limit * 0.8 ? 'bold' : undefined
                    }}
                  >
                    {subscriptionUsage?.limit && subscriptionUsage.used >= subscriptionUsage.limit * 0.8 ? 'Fazer Upgrade' : 'Alterar plano'}
                  </Link>
                </div>
                {vetId && <ShareProfileButton veterinarioId={vetId} />}
                <Link href="/dashboard/veterinario/perfil" className={styles.editProfileButton}>
                  Editar Perfil
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* Layout em duas colunas */}
        <div className={styles.mainContent}>
          {/* Coluna Esquerda - Calendário */}
          <div className={styles.leftColumn} style={{ position: 'relative' }}>
            {(!vetPlanoAtual || vetPlanoAtual === 'none') && (
              <div style={{
                position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                backgroundColor: 'rgba(255, 255, 255, 0.7)', backdropFilter: 'blur(4px)',
                zIndex: 10, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                borderRadius: '16px', border: '1px solid #e2e8f0'
              }}>
                <Crown size={48} color="#e67e22" style={{ marginBottom: '16px' }} />
                <h3 style={{ fontSize: '1.25rem', fontWeight: 600, color: '#1e293b', marginBottom: '8px' }}>Assinatura Necessária</h3>
                <p style={{ color: '#64748b', textAlign: 'center', maxWidth: '300px', marginBottom: '24px' }}>
                  Para visualizar sua agenda e gerenciar consultas, por favor assine um de nossos planos.
                </p>
                <button
                  onClick={() => router.push("/dashboard/veterinario/alterar-plano")}
                  style={{
                    backgroundColor: '#e67e22', color: 'white', padding: '10px 24px', borderRadius: '8px',
                    fontWeight: 600, border: 'none', cursor: 'pointer', transition: 'background-color 0.2s'
                  }}
                >
                  Ver Planos
                </button>
              </div>
            )}
            <div style={{ filter: (!vetPlanoAtual || vetPlanoAtual === 'none') ? 'blur(4px)' : 'none', pointerEvents: (!vetPlanoAtual || vetPlanoAtual === 'none') ? 'none' : 'auto' }}>
              <div className={styles.calendarCard}>
              <div className={styles.calendarHeader}>
                <h2 className={styles.sectionTitle} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: 0 }}>
                  <CalendarIcon size={20} className={styles.metaInfoIcon} />
                  Agenda
                </h2>


              </div>
              <div className={styles.calendarContainer} data-view={view}>
                <CustomCalendar
                  events={events}
                  date={currentDate}
                  onNavigate={(date) => setCurrentDate(date)}
                  view={view}
                  onViewChange={(newView) => setView(newView)}
                  onSelectEvent={(event) => {
                    setSelectedEvent(event as any);
                    setIsModalOpen(true);
                  }}
                  onSelectSlot={(slotInfo) => {
                    const date = moment(slotInfo.start)
                      .startOf("day")
                      .toDate();
                    setSelectedDate(date);
                    carregarConsultasPorData(date);
                  }}
                  statusMeta={statusMeta}
                />
              </div>
            </div>

            {/* Próximas Consultas */}
            <div className={styles.appointmentsCard}>
              <div className={styles.appointmentsHeader}>
                <h3 className={styles.cardTitle} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: 0 }}>
                  <Clock size={20} className={styles.metaInfoIcon} />
                  Consultas do dia
                </h3>
                <div className={styles.dateNav}>
                  <button
                    type="button"
                    className={styles.dateButton}
                    onClick={() => alterarDia(-1)}
                    aria-label="Dia anterior"
                    title="Dia anterior"
                  >
                    ◀
                  </button>
                  <div className={styles.datePickerWrapper}>
                    <button
                      type="button"
                      className={styles.dateLabelButton}
                      onClick={() => dateInputRef.current?.showPicker ? dateInputRef.current.showPicker() : dateInputRef.current?.click()}
                      title="Selecionar data"
                    >
                      <CalendarIcon size={16} className={styles.calendarIcon} />
                      <span className={styles.dateLabelText}>{labelData}</span>
                    </button>
                    <input
                      type="date"
                      ref={dateInputRef}
                      className={styles.hiddenDateInput}
                      value={moment(selectedDate).format("YYYY-MM-DD")}
                      onChange={(e) => {
                        if (e.target.value) {
                          const novaData = moment(e.target.value).toDate();
                          setSelectedDate(novaData);
                          carregarConsultasPorData(novaData);
                        }
                      }}
                    />
                  </div>
                  {/* {!isHoje && (
                    <button
                      type="button"
                      className={styles.todayButton}
                      onClick={() => {
                        const hoje = new Date();
                        setSelectedDate(hoje);
                        carregarConsultasPorData(hoje);
                      }}
                      aria-label="Ir para hoje"
                      title="Ir para hoje"
                    >
                      Hoje
                    </button>
                  )} */}
                  <button
                    type="button"
                    className={styles.dateButton}
                    onClick={() => alterarDia(1)}
                    aria-label="Próximo dia"
                    title="Próximo dia"
                  >
                    ▶
                  </button>
                </div>
              </div>

              <div className={styles.sectionInstruction}>
                <p>Aqui você visualiza suas consultas do dia, com a possibilidade de ver detalhes ou iniciar o atendimento.</p>
              </div>

              <div className={styles.appointmentsList}>
                {isLoadingConsultas && (
                  <div className={styles.loadingContainer}>
                    <p>Carregando consultas...</p>
                  </div>
                )}
                {dashboardData.proximasConsultas.map((consulta) => {
                  const statusKey = (consulta.status || "").toLowerCase();
                  const statusLabel =
                    statusKey === "concluido" ||
                      statusKey === "concluida" ||
                      statusKey === "realizado"
                      ? "Concluída"
                      : statusKey === "em andamento"
                        ? "Em andamento"
                        : statusKey === "pendente"
                          ? "Aguardando"
                          : statusKey === "confirmado"
                            ? "Confirmado"
                            : statusKey === "cancelado"
                              ? "Cancelado"
                              : consulta.status
                                ? consulta.status.charAt(0).toUpperCase() +
                                consulta.status.slice(1)
                                : "";
                  const cssStatusKey = statusKey.replace(/\s+/g, "-");
                  const statusClass = [
                    styles.statusBadge,
                    statusKey && styles[`status-${cssStatusKey}`],
                  ]
                    .filter(Boolean)
                    .join(" ");

                  return (
                    <div
                      key={consulta.id}
                      className={styles.appointmentItem}
                      role="article"
                      onClick={() => {
                        // Abre o modal ao clicar em um item da lista
                        const [h, m] = (consulta.horario || "00:00").split(
                          ":"
                        );
                        const start = moment(selectedDate)
                          .set({
                            hour: parseInt(h || "0"),
                            minute: parseInt(m || "0"),
                            second: 0,
                          })
                          .toDate();
                        const end = moment(start).add(1, "hour").toDate();
                        const ev: CalendarEvent = {
                          id: consulta.id,
                          title: `${consulta.cliente}${consulta.pet ? " • " + consulta.pet : ""
                            }`,
                          start,
                          end,
                          resource: {
                            cliente: consulta.cliente,
                            clienteSobrenome: consulta.clienteSobrenome,
                            pet: consulta.pet,
                            petRaca: consulta.petRaca,
                            petPorte: consulta.petPorte,
                            petEspecie: consulta.petEspecie,
                            tipo: consulta.tipo,
                            status: consulta.status,
                            observacoes: consulta.observacoes,
                            localNome: consulta.localNome,
                            localEndereco: consulta.localEndereco,
                            valor: consulta.valor,
                            horario: consulta.horario,
                            petFotoUrl: consulta.petFotoUrl,
                          },



                        };
                        setSelectedEvent(ev);
                        const s = (consulta.status || "").toLowerCase();
                        // Se já estiver em andamento, realizado ou cancelado, abre apenas detalhes
                        if (
                          s === "em andamento" ||
                          s === "realizado" ||
                          s === "concluido" ||
                          s === "cancelado"
                        ) {
                          setIsModalOpen(true);
                        } else {
                          // Senão (pendente/confirmado/aguardando), abre modal de código
                          setIsCodeModalOpen(true);
                        }
                      }}
                      aria-label={`Consulta ${consulta.tipo} às ${consulta.horario
                        } para ${consulta.cliente}${consulta.pet ? ` e pet ${consulta.pet}` : ""
                        }${statusLabel ? `, status ${statusLabel}` : ""}`}
                    >

                      <div className={styles.appointmentDetails}>
                        <div className={styles.appointment}>

                          <div className={styles.appointmentAddressName}>
                            <span>
                              {(consulta.localNome) == null ? "Nome não informado" : consulta.localNome}
                            </span>
                            <span className={styles.consultHour}>{consulta.horario}</span>
                          </div>
                          <div>
                            <div>
                              {(consulta.valor !== undefined && consulta.valor !== null) && (
                                <div className={styles.metaInfoItem} title="Valor da Consulta">
                                  <span className={styles.priceValue}>
                                    R$ {consulta.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>


                        </div>

                        <p className={styles.appointmentAddress}>
                          {consulta.localEndereco}
                        </p>



                        <div className={styles.detailsConsult}>
                          <div className={styles.detailsConsultTitle}>
                            <span>Detalhes da consulta</span>
                          </div>

                          <div className={styles.appointmentMetaInfos}>

                            <div className={styles.metaInfoItem} title="Cliente">
                              <UserIcon className={styles.metaInfoIcon} />
                              <span className={styles.metaInfoText}>
                                {consulta.clienteSobrenome
                                  ? `${consulta.cliente} ${consulta.clienteSobrenome}`
                                  : consulta.cliente}
                              </span>
                            </div>

                            {consulta.pet && (
                              <>
                                <div className={styles.metaInfoItem} title="Pet">
                                  <Dog className={styles.metaInfoIcon} size={16} />
                                  <span className={styles.metaInfoText}>
                                    {consulta.pet}
                                  </span>
                                </div>

                                {(consulta.petEspecie || consulta.petRaca) && (
                                  <div className={styles.metaInfoItem} title="Raça/Espécie">
                                    <Tag className={styles.metaInfoIcon} size={16} />
                                    <span className={styles.metaInfoText}>
                                      {consulta.petEspecie || "Espécie não inf."}
                                      {consulta.petRaca ? ` (${consulta.petRaca})` : ""}
                                    </span>
                                  </div>
                                )}

                                {consulta.petPorte && (
                                  <div className={styles.metaInfoItem} title="Porte">
                                    <Maximize2 className={styles.metaInfoIcon} size={16} />
                                    <span className={styles.metaInfoText}>
                                      <span className={styles.porteBadge} data-porte={consulta.petPorte.toLowerCase()}>
                                        Porte {consulta.petPorte.charAt(0).toUpperCase() + consulta.petPorte.slice(1)}
                                      </span>
                                    </span>
                                  </div>
                                )}
                              </>
                            )}



                          </div>

                          <div className={styles.appointmentFooter}>
                            {statusLabel && (
                              <span className={statusClass}>{statusLabel}</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
                {!isLoadingConsultas &&
                  dashboardData.proximasConsultas.length === 0 && (
                    <p style={{ color: "#64748b" }}>
                      Nenhuma consulta para {labelData.toLowerCase()}.
                    </p>
                  )}
              </div>
            </div>
            </div>
          </div>

          {/* Coluna Direita - Informações e Estatísticas */}
          <div className={styles.rightColumn}>

            <div className={styles.infoCard}>
              <h2 className={styles.cardTitle} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: 0 }}>
                <TrendingUp size={20} className={styles.metaInfoIcon} />
                Visão geral do desempenho
              </h2>
              {/* Estatísticas dentro de um único card */}
              <div className={styles.statsGrid}>
                <div className={styles.statCard}>
                  <div className={styles.statContent}>
                    <h3 className={styles.statNumber}>
                      {dashboardData.agendamentosHoje}
                    </h3>
                    <p className={styles.statLabel}>Consultas Hoje</p>
                  </div>
                </div>

                <div className={styles.statCard}>
                  <div className={styles.statContent}>
                    <h3 className={styles.statNumber}>
                      {dashboardData.agendamentosSemana}
                    </h3>
                    <p className={styles.statLabel}>Esta Semana</p>
                  </div>
                </div>

                <div className={styles.statCard}>
                  <div className={styles.statContent}>
                    <h3 className={styles.statNumber}>
                      {dashboardData.agendamentosMes}
                    </h3>
                    <p className={styles.statLabel}>Este Mês</p>
                  </div>
                </div>

                <div className={styles.statCard}>
                  <div className={styles.statContent}>
                    <h3 className={styles.statNumber}>
                      {dashboardData.totalClientes}
                    </h3>
                    <p className={styles.statLabel}>Total de Clientes</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Seção de Locais registrados */}
            <div className={styles.commentsCard}>
              <h3 className={styles.cardTitle} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: 8 }}>
                <MapPin size={20} className={styles.metaInfoIcon} />
                Locais de atendimento
              </h3>
              <div className={styles.commentsList}>
                {/* Se a lista estiver vazia */}
                {vetEnderecos.length === 0 && (
                  <p style={{ color: "#64748b" }}>
                    Nenhum local cadastrado.
                  </p>
                )}
                {/* Mapeando os endereços reais */}
                {vetEnderecos.map((endereco, index) => (
                  <div key={endereco.id || index} className={styles.commentItem}>
                    <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                      {/* Ícone ou Imagem do Local */}
                      <div style={{
                        width: '40px',
                        height: '40px',
                        borderRadius: '8px',
                        backgroundColor: '#f1f5f9',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#64748b',
                        flexShrink: 0
                      }}>
                        {endereco.fotoUrl ? (
                          <Image src={endereco.fotoUrl} alt="Local" width={40} height={40} style={{ borderRadius: '8px', objectFit: 'cover' }} />
                        ) : (
                          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" style={{ width: '24px', height: '24px' }}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
                          </svg>
                        )}
                      </div>
                      <div>
                        {/* Nome da Clínica ou "Consultório" */}
                        <h4 style={{ margin: '0 0 4px 0', fontSize: '1rem', color: '#1e293b' }}>
                          {endereco.nomeClinica || "Consultório"}
                        </h4>
                        {/* Endereço formatado */}
                        <p style={{ margin: 0, color: '#64748b', fontSize: '0.875rem' }}>
                          {endereco.rua ? `${endereco.rua}, ${endereco.numero}` : endereco.cidade}
                          {endereco.bairro && ` - ${endereco.bairro}`}
                        </p>
                        <p style={{ margin: 0, color: '#94a3b8', fontSize: '0.75rem' }}>
                          {endereco.cidade} - {endereco.estado}
                        </p>
                        {/* Preço da Consulta */}
                        {endereco.precoConsulta !== undefined && (
                          <p style={{ margin: '4px 0 0 0', color: '#e67e22', fontWeight: 600, fontSize: '0.875rem' }}>
                            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(endereco.precoConsulta)}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className={styles.commentsCard}>
              <h3 className={styles.cardTitle} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: 8 }}>
                <MessageCircle size={20} className={styles.metaInfoIcon} />
                Avaliações Recentes
              </h3>
              <div className={styles.commentsList}>
                {recentComments.length === 0 && (
                  <p style={{ color: "#64748b" }}>
                    Sem avaliações recentes.
                  </p>
                )}
                {recentComments.map((rev: any) => (
                  <div key={rev.id} className={styles.reviewItem}>
                    <div className={styles.reviewHeader}>
                      <strong className={styles.reviewTutorName}>
                        {rev.tutor?.nome ? `${rev.tutor.nome} ${rev.tutor.sobrenome || ''}`.trim() : 'Tutor Anônimo'}
                        {rev.pet?.nome && <span style={{ fontWeight: 400, opacity: 0.7 }}> • {rev.pet.nome}</span>}
                      </strong>
                      <div className={styles.reviewStars}>
                        {[...Array(5)].map((_, i) => (
                          <Star key={i} size={14} fill={i < (rev.estrelas || 0) ? "#fab005" : "none"} stroke={i < (rev.estrelas || 0) ? "none" : "#cbd5e1"} />
                        ))}
                      </div>
                    </div>
                    <p className={styles.reviewText}>
                      {rev.comentario || <span style={{ fontStyle: 'italic', opacity: 0.5 }}>Sem comentário</span>}
                    </p>
                    <div className={styles.reviewDate}>
                      {[
                        rev.data ? moment(rev.data).format('DD/MM/YYYY') : null,
                        rev.hora
                      ].filter(Boolean).join(" • ")}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div >

      {isModalOpen && selectedEvent && (
        <div className={styles.modalOverlay} role="dialog" aria-modal="true">
          <div className={`${styles.modalCard} ${styles.modalCardLarge}`}>
            <div className={styles.modalHeader}>
              <h4 className={styles.modalTitle}>
                {((selectedEvent.resource?.status || "").toLowerCase() === "em andamento")
                  ? "Consulta em Andamento"
                  : "Detalhes da Consulta"}
              </h4>
              <button
                className={styles.modalClose}
                aria-label="Fechar"
                onClick={() => setIsModalOpen(false)}
              >
                ✕
              </button>
            </div>
            <div className={styles.modalBody}>
              {/* Seção 1: Informações da Consulta */}
              <div className={styles.modalSection}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <h5 className={styles.modalSectionTitle} style={{ margin: 0 }}>Informações Gerais</h5>
                  <span className={`${styles.statusBadge} ${styles[`status-${(selectedEvent.resource?.status || "").toLowerCase().replace(/\s+/g, "-")}`]}`}>
                    {selectedEvent.resource?.status}
                  </span>
                </div>

                <div className={styles.modalGrid}>
                  <div className={styles.infoCardSmall}>
                    <UserIcon size={16} className={styles.infoCardIcon} />
                    <div>
                      <span className={styles.infoCardLabel}>Tutor</span>
                      <span className={styles.infoCardValue}>
                        {selectedEvent.resource?.cliente} {selectedEvent.resource?.clienteSobrenome}
                      </span>
                    </div>
                  </div>

                  <div className={styles.infoCardSmall}>
                    <CalendarIcon size={16} className={styles.infoCardIcon} />
                    <div>
                      <span className={styles.infoCardLabel}>Data e Hora</span>
                      <span className={styles.infoCardValue}>
                        {moment(selectedEvent.start).format("DD/MM/YYYY")} às {selectedEvent.resource?.horario}
                      </span>
                    </div>
                  </div>

                  <div className={styles.infoCardSmall}>
                    <CreditCard size={16} className={styles.infoCardIcon} />
                    <div>
                      <span className={styles.infoCardLabel}>Valor</span>
                      <span className={styles.infoCardValue}>
                        {(selectedEvent.resource?.valor !== undefined && selectedEvent.resource?.valor !== null)
                          ? `R$ ${selectedEvent.resource.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
                          : "Não informado"}
                      </span>
                    </div>
                  </div>

                  <div className={styles.infoCardSmall}>
                    <Tag size={16} className={styles.infoCardIcon} />
                    <div>
                      <span className={styles.infoCardLabel}>Atendimento</span>
                      <span className={styles.infoCardValue}>{selectedEvent.resource?.tipo}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Seção 2: Local de Atendimento */}
              <div className={styles.modalSection}>
                <div className={styles.infoCardFull}>
                  <MapPin size={18} className={styles.infoCardIcon} />
                  <div>
                    <span className={styles.infoCardLabel}>Endereço do Atendimento</span>
                    <span className={styles.infoCardValue}>
                      {selectedEvent.resource?.localNome} - {selectedEvent.resource?.localEndereco}
                    </span>
                  </div>
                </div>
              </div>

              {/* Seção 3: Perfil do Pet */}
              <div className={styles.modalSection}>
                <h5 className={styles.modalSectionTitle}>Perfil do Pet</h5>
                <div className={styles.petProfileWrapper}>
                  <div className={styles.petGallery}>
                    <div className={styles.mainPhotoWrapper}>
                      {selectedEvent.resource?.petFotoUrl ? (
                        <Image
                          src={selectedEvent.resource.petFotoUrl}
                          alt={selectedEvent.resource.pet}
                          width={100}
                          height={100}
                          className={styles.petMainPhoto}
                        />
                      ) : (
                        <div className={styles.petPhotoPlaceholder}>
                          <Dog size={32} />
                        </div>
                      )}
                    </div>
                  </div>

                  <div className={styles.petDetailsCard}>
                    <div className={styles.petNameHeader}>{selectedEvent.resource?.pet}</div>
                    <div className={styles.petSpecsRow}>
                      <div className={styles.petSpecItem}>
                        <Tag size={14} className={styles.specIcon} />
                        <span>
                          {selectedEvent.resource?.petEspecie}
                          {selectedEvent.resource?.petRaca ? ` (${selectedEvent.resource.petRaca})` : ""}
                        </span>
                      </div>
                      <div className={styles.petSpecItem}>
                        <Maximize2 size={14} className={styles.specIcon} />
                        <span className={styles.porteBadgeSimple} data-porte={selectedEvent.resource?.petPorte?.toLowerCase()}>
                          Porte {selectedEvent.resource?.petPorte}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Seção 4: Observações */}
              {selectedEvent.resource?.observacoes && (
                <div className={styles.modalSection}>
                  <h5 className={styles.modalSectionTitle}>
                    <MessageCircle size={14} style={{ marginRight: 6 }} />
                    Observações do Tutor
                  </h5>
                  <div className={styles.obsBox}>
                    {selectedEvent.resource.observacoes}
                  </div>
                </div>
              )}

              {/* Seção 5: Instruções para o Veterinário (Novo) */}
              <div className={styles.instructionsBox}>
                <div className={styles.instructionsTitle}>
                  <Info size={16} />
                  <span>Dicas para Finalizar o Atendimento</span>
                </div>
                <ul className={styles.instructionsList}>
                  <li className={styles.instructionItem}>
                    <div className={styles.instructionBullet} />
                    <span><strong>Orientação ao Tutor:</strong> Explique o diagnóstico e os passos do tratamento, garantindo que o tutor saiba como agir em casa.</span>
                  </li>
                  <li className={styles.instructionItem}>
                    <div className={styles.instructionBullet} />
                    <span><strong>Sinais de Alerta:</strong> Informe quais sintomas indicam que o pet deve retornar para uma emergência imediatamente.</span>
                  </li>
                  <li className={styles.instructionItem}>
                    <div className={styles.instructionBullet} />
                    <span><strong>Finalização Técnica:</strong> Verifique se todas as doses e frequências das medicações estão corretas no prontuário.</span>
                  </li>
                  <li className={styles.instructionItem}>
                    <div className={styles.instructionBullet} />
                    <span><strong>Feedback:</strong> Lembre o tutor de avaliar seu atendimento no app, isso ajuda muito na visibilidade do seu perfil!</span>
                  </li>
                </ul>
              </div>
            </div>
            <div className={styles.modalFooter}>
              <button
                className={styles.secondaryButton}
                onClick={() => setIsModalOpen(false)}
              >
                Fechar
              </button>
              {(selectedEvent.resource?.status || "").toLowerCase() === "em andamento" && (
                <button
                  className={styles.primaryButton}
                  onClick={concluirAgendamentoSelecionado}
                  disabled={isConcluding}
                >
                  {isConcluding ? "Finalizando..." : "Finalizar Atendimento"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {isCodeModalOpen && selectedEvent && (
        <div className={styles.modalOverlay} role="dialog" aria-modal="true">
          <div className={`${styles.modalCard} ${styles.modalCardLarge}`}>

            <div className={styles.modalHeader}>
              <h4 className={styles.modalTitle}>Detalhes e Início da Consulta</h4>
              <button
                className={styles.modalClose}
                aria-label="Fechar"
                onClick={() => {
                  setIsCodeModalOpen(false);
                  setStartCode("");
                  setStartError(null);
                }}
              >
                ✕
              </button>
            </div>
            <div className={styles.modalBody}>
              {/* Seção 1: Informações da Consulta */}
              <div className={styles.modalSection}>
                <h5 className={styles.modalSectionTitle}>Informações Gerais</h5>
                <div className={styles.modalGrid}>
                  <div className={styles.infoCardSmall}>
                    <UserIcon size={16} className={styles.infoCardIcon} />
                    <div>
                      <span className={styles.infoCardLabel}>Tutor</span>
                      <span className={styles.infoCardValue}>
                        {selectedEvent.resource?.cliente} {selectedEvent.resource?.clienteSobrenome}
                      </span>
                    </div>
                  </div>

                  <div className={styles.infoCardSmall}>
                    <CalendarIcon size={16} className={styles.infoCardIcon} />
                    <div>
                      <span className={styles.infoCardLabel}>Data e Hora</span>
                      <span className={styles.infoCardValue}>
                        {moment(selectedEvent.start).format("DD/MM/YYYY")} às {selectedEvent.resource?.horario}
                      </span>
                    </div>
                  </div>

                  <div className={styles.infoCardSmall}>
                    <CreditCard size={16} className={styles.infoCardIcon} />
                    <div>
                      <span className={styles.infoCardLabel}>Valor</span>
                      <span className={styles.infoCardValue}>
                        {(selectedEvent.resource?.valor !== undefined && selectedEvent.resource?.valor !== null)
                          ? `R$ ${selectedEvent.resource.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
                          : "Não informado"}

                      </span>
                    </div>
                  </div>

                  <div className={styles.infoCardSmall}>
                    <Tag size={16} className={styles.infoCardIcon} />
                    <div>
                      <span className={styles.infoCardLabel}>Atendimento</span>
                      <span className={styles.infoCardValue}>{selectedEvent.resource?.tipo}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Seção 2: Local de Atendimento */}
              <div className={styles.modalSection}>
                <div className={styles.infoCardFull}>
                  <MapPin size={18} className={styles.infoCardIcon} />
                  <div>
                    <span className={styles.infoCardLabel}>Endereço do Atendimento</span>
                    <span className={styles.infoCardValue}>
                      {selectedEvent.resource?.localNome} - {selectedEvent.resource?.localEndereco}
                    </span>
                  </div>
                </div>
              </div>

              {/* Seção 3: Perfil do Pet (Agrupado com Fotos) */}
              <div className={styles.modalSection}>
                <h5 className={styles.modalSectionTitle}>Perfil do Pet</h5>
                <div className={styles.petProfileWrapper}>
                  <div className={styles.petGallery}>
                    <div className={styles.mainPhotoWrapper}>
                      {selectedEvent.resource?.petFotoUrl ? (
                        <Image
                          src={selectedEvent.resource.petFotoUrl}
                          alt={selectedEvent.resource.pet}
                          width={100}
                          height={100}
                          className={styles.petMainPhoto}
                        />
                      ) : (
                        <div className={styles.petPhotoPlaceholder}>
                          <Dog size={32} />
                        </div>
                      )}
                    </div>
                    <div className={styles.sideGallery}>
                      <div className={styles.gallerySlot}><Camera size={14} /></div>
                      <div className={styles.gallerySlot}><Camera size={14} /></div>
                      <div className={styles.gallerySlot}><Camera size={14} /></div>
                    </div>
                  </div>

                  <div className={styles.petDetailsCard}>
                    <div className={styles.petNameHeader}>{selectedEvent.resource?.pet}</div>
                    <div className={styles.petSpecsRow}>
                      <div className={styles.petSpecItem}>
                        <Tag size={14} className={styles.specIcon} />
                        <span>
                          {selectedEvent.resource?.petEspecie}
                          {selectedEvent.resource?.petRaca ? ` (${selectedEvent.resource.petRaca})` : ""}
                        </span>
                      </div>
                      <div className={styles.petSpecItem}>
                        <Maximize2 size={14} className={styles.specIcon} />
                        <span className={styles.porteBadgeSimple} data-porte={selectedEvent.resource?.petPorte?.toLowerCase()}>
                          Porte {selectedEvent.resource?.petPorte}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>




              {/* Seção 4: Observações */}
              {selectedEvent.resource?.observacoes && (
                <div className={styles.modalSection}>
                  <h5 className={styles.modalSectionTitle}>
                    <MessageCircle size={14} style={{ marginRight: 6 }} />
                    Observações do Tutor
                  </h5>
                  <div className={styles.obsBox}>
                    {selectedEvent.resource.observacoes}
                  </div>
                </div>
              )}

              {/* Seção 5: Instruções para o Veterinário (Novo) */}
              <div className={styles.instructionsBox} style={{ marginTop: 24, marginBottom: 8 }}>
                <div className={styles.instructionsTitle}>
                  <Info size={16} />
                  <span>Dicas para o Início da Consulta</span>
                </div>
                <ul className={styles.instructionsList}>
                  <li className={styles.instructionItem}>
                    <div className={styles.instructionBullet} />
                    <span><strong>Histórico:</strong> Revise rapidamente as vacinas e atendimentos anteriores no perfil do pet.</span>
                  </li>
                  <li className={styles.instructionItem}>
                    <div className={styles.instructionBullet} />
                    <span><strong>Conexão:</strong> Ganhe a confiança do pet antes de iniciar o exame físico para reduzir o estresse.</span>
                  </li>
                  <li className={styles.instructionItem}>
                    <div className={styles.instructionBullet} />
                    <span><strong>Anamnese:</strong> Confirme o motivo principal da consulta e possíveis alterações recentes na rotina.</span>
                  </li>
                </ul>
              </div>

              {/* Seção Final: Iniciar Consulta */}
              <div className={styles.startConsultationSection}>
                <h5 className={styles.startTitle}>Iniciar Antendimento</h5>
                <p className={styles.startDescription}>
                  Para iniciar, solicite ao tutor o <strong>código de 6 dígitos</strong> gerado no aplicativo dele.
                </p>

                <div className={styles.codeInputWrapper}>
                  <input
                    aria-label="Código de início da consulta"
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={6}
                    value={startCode}
                    onChange={(e) => {
                      const v = e.target.value.replace(/\D+/g, "");
                      setStartCode(v);
                    }}
                    className={styles.codeInput}
                    placeholder="0 0 0 0 0 0"
                  />

                  <button
                    className={styles.startBtn}
                    disabled={isStarting || startCode.length !== 6}
                    onClick={async () => {
                      if (!selectedEvent) return;
                      setIsStarting(true);
                      setStartError(null);
                      const res =
                        await VeterinarioDashboardService.iniciarAgendamento(
                          selectedEvent.id,
                          startCode
                        );
                      setIsStarting(false);
                      if (!res.ok) {
                        setStartError(res.error || "Código inválido");
                        return;
                      }
                      // Atualiza status no estado local
                      setEvents((prev) =>
                        prev.map((ev) =>
                          ev.id === selectedEvent.id
                            ? {
                              ...ev,
                              resource: {
                                ...(ev.resource as any),
                                status: "em andamento",
                              },
                            }
                            : ev
                        )
                      );
                      setDashboardData((prev) => ({
                        ...prev,
                        proximasConsultas: prev.proximasConsultas.map((c) =>
                          c.id === selectedEvent.id
                            ? { ...c, status: "em andamento" }
                            : c
                        ),
                      }));
                      setIsCodeModalOpen(false);
                      setStartCode("");
                      setStartError(null);
                    }}
                  >
                    {isStarting ? "Validando..." : "Confirmar e Iniciar"}
                  </button>
                </div>

                {startError && (
                  <div
                    className={styles.errorRow}
                    role="alert"
                    aria-live="assertive"
                    style={{ marginTop: 12 }}
                  >
                    <svg
                      className={styles.errorIcon}
                      viewBox="0 0 24 24"
                      xmlns="http://www.w3.org/2000/svg"
                      aria-hidden="true"
                    >
                      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
                      <path d="M12 7v6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                      <circle cx="12" cy="17" r="1.5" fill="currentColor" />
                    </svg>
                    <span>{startError}</span>
                  </div>
                )}
              </div>
            </div>
            <div className={styles.modalFooter} style={{ borderTop: 'none', paddingTop: 0 }}>
              <button
                className={styles.secondaryButton}
                onClick={() => {
                  setIsCodeModalOpen(false);
                  setStartCode("");
                  setStartError(null);
                }}
              >
                Voltar
              </button>
            </div>
          </div>
        </div>
      )}

    </>
  );
}

