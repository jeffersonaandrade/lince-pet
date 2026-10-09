"use client";

import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect, useState, useMemo, useRef } from "react";
import {
  ClinicaDashboardService,
  Profissional,
  AgendamentoDashboard
} from "@/services/clinicas/dashboard";
import CustomCalendar from "@/components/CustomCalendar/CustomCalendar";
import moment from "moment";
import "moment/locale/pt-br";
import styles from "./clinica.module.css";
import { AvaliacoesService } from "@/services/avaliacoes/avaliacoes";
import { getClinicaOnboardingProgress } from "@/services/clinicas/clinicas";
import { AssinaturasService } from "@/services/assinaturas/assinaturas";
import Link from "next/link";
import ProfileImageUploader from "@/components/ProfileImageUploader/ProfileImageUploader";
import ShareProfileButton from "@/components/ShareProfileButton/ShareProfileButton";
import TutorContact from "@/components/TutorContact/TutorContact";
import BloqueiosLista from "@/components/BloqueioAgenda/BloqueiosLista";
import ProntuarioPet from "@/components/Prontuario/ProntuarioPet";
import EncaminharModal from "@/components/Encaminhamento/EncaminharModal";
import PainelRecebidos from "@/components/Encaminhamento/PainelRecebidos";
import Image from "next/image";
import { formatDateToISO } from "@/utils/formatters";

// Configurar moment para português
moment.locale("pt-br");

import {
  Calendar as CalendarIcon,
  CheckCircle,
  Clock,
  Dog,
  Maximize2,
  Tag,
  User as UserIcon,
  Video,
  MapPin,
  CreditCard,
  MessageCircle,
  Star,
  Camera,
  Info,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  Stethoscope,
  Mail,
  Send
} from "lucide-react";

const STATUS_ENCAMINHAVEL = ["em andamento", "emandamento", "realizado", "concluido", "concluida", "finalizado"];

// Interface para os eventos do calendário
interface CalendarEvent {
  id: number | string;
  title: string;
  start: Date;
  end: Date;
  resource?: {
    cliente: string;
    clienteSobrenome?: string;
    tutorTelefone?: string | null;
    tutorEmail?: string | null;
    petId?: string | null;
    pet: string;
    petRaca?: string;
    petPorte?: string;
    petEspecie?: string;
    veterinario?: string;
    veterinarioSobrenome?: string;
    tipo: string;
    status: string;
    observacoes?: string;
    localNome?: string;
    localEndereco?: string;
    valor?: number;
    horario?: string;
    petFotoUrl?: string | null;
  };
}

interface DashboardData {
  agendamentosHoje: number;
  agendamentosSemana: number;
  agendamentosMes: number;
  totalClientes: number;
  proximasConsultas: AgendamentoDashboard[];
}

export default function ClinicaDashboard() {
  const { user, loading, updateUser } = useAuth();
  const router = useRouter();
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [isLoadingConsultas, setIsLoadingConsultas] = useState(false);
  const [view, setView] = useState<'month' | 'week' | 'day'>("month");
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [encaminhando, setEncaminhando] = useState<{ id: string | number; pet?: string | null } | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [clinicaId, setClinicaId] = useState<string | null>(null);

  // Clinic specific states
  const [profissionais, setProfissionais] = useState<Profissional[]>([]);
  const [bloqueioVetId, setBloqueioVetId] = useState<string | null>(null);
  const [recentComments, setRecentComments] = useState<any[]>([]); // Assuming same structure for now, probably need specific clinic comments service later

  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [dashboardData, setDashboardData] = useState<DashboardData>({
    agendamentosHoje: 0,
    agendamentosSemana: 0,
    agendamentosMes: 0,
    totalClientes: 0,
    proximasConsultas: [],
  });

  const rankingVeterinarios = useMemo(() => {
    if (!profissionais) return [];

    const startOfWeek = moment(selectedDate).startOf('week');
    const endOfWeek = moment(selectedDate).endOf('week');

    const weekEvents = events.filter(ev => {
      const evDate = moment(ev.start);
      return evDate.isBetween(startOfWeek, endOfWeek, 'day', '[]');
    });

    // Map over all professionals instead of just events
    const ranked = profissionais.map(pro => {
      const pFull = `${pro.nome} ${pro.sobrenome}`.trim();

      const count = weekEvents.filter(ev => {
        const evVetName = `${ev.resource?.veterinario || ''} ${ev.resource?.veterinarioSobrenome || ''}`.trim();
        // Simple name match as fallback if IDs aren't available in events
        return evVetName === pFull;
      }).length;

      return {
        name: pFull,
        count,
        photoUrl: pro.fotoUrl
      };
    });

    // Sort by count descending
    return ranked.sort((a, b) => b.count - a.count).slice(0, 5);

  }, [events, selectedDate, profissionais]);

  const [currentDate, setCurrentDate] = useState(new Date());

  // Profile Image State
  const clinicaNome = user?.nome || "Clínica";
  const [clinicaFoto, setClinicaFoto] = useState<string | null>(null);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const dateInputRef = useRef<HTMLInputElement | null>(null);
  
  // Plan State
  const [clinicaPlanoAtual, setClinicaPlanoAtual] = useState<string | null>(null);

  const friendlyPlanName = (planCode: string | null) => {
    if (!planCode) return "Starter";
    if (planCode === "free" || planCode === "starter") return "Starter";
    if (planCode === "clinic") return "Clinic";
    if (planCode === "clinic_pro") return "Clinic Pro";
    return planCode;
  };

  const planIconPath = (planCode: string | null) => {
    if (!planCode) return "/iconPlans/Plan1.svg";
    if (planCode === "free" || planCode === "starter") return "/iconPlans/Plan1.svg";
    if (planCode === "clinic") return "/iconPlans/Plan2.svg";
    if (planCode === "clinic_pro") return "/iconPlans/Plan3.svg";
    return "/iconPlans/Plan1.svg";
  };

  // Search Professionals
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState<Profissional[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isAddVetModalOpen, setIsAddVetModalOpen] = useState(false);

  useEffect(() => {
    if (user?.fotoUrl) {
      setClinicaFoto(user.fotoUrl);
    }

    // Fetch plan status
    if (user && user.userType === 'clinica') {
      const fetchStatus = async () => {
        try {
          const assinaturas = AssinaturasService();
          const data = await assinaturas.obterStatus();
          setClinicaPlanoAtual(data?.plan?.code || "starter");
        } catch (err) {
          console.error("Failed to load subscription status", err);
        }
      };
      fetchStatus();
    }
  }, [user]);

  const handleAvatarChange = async (file: File) => {
    try {
      setIsUploadingAvatar(true);
      const result = await ClinicaDashboardService.uploadProfilePhoto(file);
      if (result && result.url) {
        setClinicaFoto(result.url);
        if (updateUser && user) {
          updateUser({ ...user, fotoUrl: result.url });
        }
      }
    } catch (error) {
      console.error("Falha no upload:", error);
      alert("Erro ao fazer upload da imagem.");
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  useEffect(() => {
    const check = () =>
      setIsMobile(typeof window !== "undefined" && window.innerWidth <= 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  // Helpers para status: cores e ícones (Same as Vet)
  const consultationStats = useMemo(() => {
    if (!events) return { total: 0, completed: 0, cancelled: 0 };

    // Filtramos apenas status relevantes para contagem 'válida', se quiser todos, basta remover o filtro.
    // Mas geralmente 'Total' é tudo.

    // Vamos considerar o que está na tela (events).
    const total = events.length;

    const completed = events.filter(e => {
      const s = (e.resource?.status || '').toLowerCase();
      return s === 'concluido' || s === 'realizado' || s === 'concluída';
    }).length;

    const cancelled = events.filter(e => {
      const s = (e.resource?.status || '').toLowerCase();
      return s === 'cancelado';
    }).length;

    // Advanced Stats Calculation
    // 1. Average per day
    // We need to know how many days are effectively in the view.
    // Since 'events' might cover a month, let's look at the range of current view.
    // A simple approximation is taking the distinct days in 'events' if we want "active days",
    // or just dividing total by 30 (month) or 7 (week).
    // Let's use the actual days that have at least one event to be more "meaningful" for small clinics,
    // OR better: use the number of days in the current month/week view.

    let daysCount = 1;
    if (view === 'month') {
      daysCount = moment(currentDate).daysInMonth();
    } else if (view === 'week') {
      daysCount = 7;
    } else {
      daysCount = 1;
    }

    // However, if we blindly divide events.length by daysCount (e.g. 30), it might be too low.
    // Let's count unique days with appointments to give "Average on working days".
    const uniqueDays = new Set(events.map(e => moment(e.start).format('YYYY-MM-DD'))).size;
    const averagePerDay = uniqueDays > 0 ? Math.round(total / uniqueDays).toString() : "0";

    // 2. Busiest Day
    const daysOfWeekCount: Record<string, number> = {};
    events.forEach(e => {
      const dayName = moment(e.start).format('dddd'); // e.g. "segunda-feira"
      daysOfWeekCount[dayName] = (daysOfWeekCount[dayName] || 0) + 1;
    });
    let busiestDay = "-";
    let maxDayCount = 0;
    Object.entries(daysOfWeekCount).forEach(([day, count]) => {
      if (count > maxDayCount) {
        maxDayCount = count;
        busiestDay = day.split('-')[0]; // "segunda" from "segunda-feira"
        busiestDay = busiestDay.charAt(0).toUpperCase() + busiestDay.slice(1);
      }
    });

    // 3. Peak Hours (e.g. 14h-15h)
    // We'll bin by hour start
    const hoursCount: Record<number, number> = {};
    events.forEach(e => {
      const h = moment(e.start).hour();
      hoursCount[h] = (hoursCount[h] || 0) + 1;
    });

    let peakHour = "-";
    let maxHourCount = 0;
    let bestHour = -1;

    Object.entries(hoursCount).forEach(([hStr, count]) => {
      const h = parseInt(hStr);
      if (count > maxHourCount) {
        maxHourCount = count;
        bestHour = h;
      }
    });

    if (bestHour !== -1) {
      peakHour = `${bestHour}h – ${bestHour + 1}h`;
    }

    return { total, completed, cancelled, averagePerDay, busiestDay, peakHour };
  }, [events, view, currentDate]);

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

  const carregarEstatisticas = async () => {
    try {
      const estatisticas = await ClinicaDashboardService.buscarEstatisticas();
      setDashboardData(prev => ({ ...prev, ...estatisticas }));
    } catch (error) {
      console.error("Erro ao carregar estatísticas:", error);
    }
  };

  const carregarProfissionais = async () => {
    try {
      const pros = await ClinicaDashboardService.buscarProfissionais();
      setProfissionais(pros);
    } catch (error) {
      console.error("Erro ao carregar profissionais:", error);
    }
  }

  const handleSearchVet = async () => {
    if (searchTerm.length < 2) return;
    try {
      setIsSearching(true);
      const results = await ClinicaDashboardService.pesquisarProfissionais(searchTerm);
      setSearchResults(results);
    } catch (error) {
      console.error("Erro ao pesquisar veterinários:", error);
    } finally {
      setIsSearching(false);
    }
  };

  const handleAddVet = async (vetId: string) => {
    try {
      await ClinicaDashboardService.vincularProfissional(vetId);
      await carregarProfissionais();
      setIsAddVetModalOpen(false);
      setSearchTerm("");
      setSearchResults([]);
      alert("Veterinário vinculado com sucesso!");
    } catch (error: any) {
      alert(error.response?.data?.message || "Erro ao vincular veterinário.");
    }
  };

  const handleRemoveVet = async (vetId: string) => {
    if (!confirm("Tem certeza que deseja remover este profissional da clínica?")) return;
    try {
      await ClinicaDashboardService.desvincularProfissional(vetId);
      await carregarProfissionais();
      alert("Veterinário removido com sucesso!");
    } catch (error) {
      alert("Erro ao remover veterinário.");
    }
  };

  const carregarEventosCalendario = async (date: Date) => {
    try {
      const primeiroDiaMes = new Date(date.getFullYear(), date.getMonth(), 1);
      const ultimoDiaMes = new Date(date.getFullYear(), date.getMonth() + 1, 0);

      const dataInicio = formatDateToISO(primeiroDiaMes);
      const dataFim = formatDateToISO(ultimoDiaMes);

      const eventosCalendario = await ClinicaDashboardService.buscarAgendamentosCalendario(
        dataInicio,
        dataFim
      );

      setEvents(eventosCalendario);
    } catch (error) {
      console.error("Erro ao carregar eventos do calendário:", error);
    }
  };

  const carregarConsultasPorData = async (date: Date) => {
    try {
      setIsLoadingConsultas(true);
      const consultas = await ClinicaDashboardService.buscarProximasConsultas(date);
      setDashboardData((prev) => ({ ...prev, proximasConsultas: consultas }));
    } catch (error) {
      console.error("Erro ao carregar consultas por data:", error);
    } finally {
      setIsLoadingConsultas(false);
    }
  };

  const carregarAvaliacoes = async () => {
    try {
      const resp = await AvaliacoesService.listarMinhasRecentesClinica();
      if (resp && resp.avaliacoes) {
        setRecentComments(resp.avaliacoes);
      }
    } catch (error) {
      console.error("Erro ao carregar avaliações recentes", error);
    }
  };

  const carregarDadosIniciais = async () => {
    try {
      setIsLoadingData(true);
      const progresso = await getClinicaOnboardingProgress();
      const clinicaData = progresso?.clinica || progresso?.data?.clinica || progresso;
      if (clinicaData?.id) {
        setClinicaId(clinicaData.id);
      }

      await Promise.all([
        carregarEstatisticas(),
        carregarProfissionais(),
        carregarConsultasPorData(selectedDate),
        carregarEventosCalendario(currentDate),
        carregarAvaliacoes()
      ]);
    } finally {
      setIsLoadingData(false);
    }
  };

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

    carregarDadosIniciais();
  }, [user, loading, router]);

  useEffect(() => {
    if (!isLoadingData) {
      carregarEventosCalendario(currentDate);
    }
  }, [currentDate]);

  if (loading || isLoadingData) {
    return (
      <div className={styles.loadingContainer}>
        <p>Carregando...</p>
      </div>
    );
  }

  if (!user || user.userType !== "clinica") return null;

  const isHoje = moment(selectedDate).isSame(moment(), "day");
  const labelData = isHoje ? "Hoje" : moment(selectedDate).format("DD/MM/YYYY");

  const alterarDia = (delta: number) => {
    const novaData = moment(selectedDate).add(delta, "day").toDate();
    setSelectedDate(novaData);
    carregarConsultasPorData(novaData);
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
              currentImageUrl={clinicaFoto}
              onUpload={handleAvatarChange}
              isUploading={isUploadingAvatar}
              userName={clinicaNome}
              className={styles.profileImageUploader}
              borderRadius="12px"
            />
          </div>

          <div className={styles.titleSection}>
            <div className={styles.titleRow}>
              <div className={styles.welcomeText}>
                <h1 style={{ fontSize: '1.8rem', color: 'var(--text-color)', margin: 0 }}>
                  Olá, {user.nome}!
                </h1>
                <p style={{ color: '#64748b', marginTop: '0.25rem' }}>
                  Painel de Controle da Clínica
                </p>
                <div className={styles.topInfoChips}>
                  <div className={styles.infoChip} title="Vets">
                    <span className={styles.chipText}>
                      {profissionais.length} Profissionais
                    </span>
                  </div>
                </div>
              </div>

              {/* Painel à direita com Créditos e Plano atual */}
              <div className={styles.headerRightPanel}>
                <div className={styles.metricBox} title="Plano atual">
                  <div className={styles.metricLabel}>Plano atual</div>
                  <div className={styles.metricValue} style={{ display: 'flex', justifyContent: 'flex-start', alignItems: 'center', gap: '8px' }}>
                    {planIconPath(clinicaPlanoAtual) && (
                      <img
                        src={planIconPath(clinicaPlanoAtual)!}
                        alt="Ícone do plano"
                        width={42}
                        height={42}
                        style={{ borderRadius: '6px', objectFit: 'contain', flexShrink: 0 }}
                      />
                    )}
                    <span className={styles.namePlan}> {friendlyPlanName(clinicaPlanoAtual)} </span>
                  </div>
                  <Link
                    href="/dashboard/clinica/alterar-plano"
                    className={styles.planLink}
                  >
                    Alterar plano
                  </Link>
                </div>
                <ShareProfileButton clinicaId={clinicaId || user.id} />
                {/* Links de edição */}
                <Link href="/dashboard/clinica/perfil" className={styles.editProfileButton}>
                  Editar Perfil
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* Layout em duas colunas */}
        <div className={styles.mainContent}>
          {/* Coluna Esquerda - Calendário */}
          <div className={styles.leftColumn}>
            <div className={styles.calendarCard}>
              <div className={styles.calendarHeader}>
                <h2 className={styles.sectionTitle}>Agenda da Clínica</h2>
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

            {profissionais.length > 0 && (
              <div className="mt-4 flex flex-col gap-2">
                <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
                  Gerenciar bloqueios do profissional
                  <select
                    className="rounded-lg border border-solid border-slate-300 bg-white px-3 py-2 text-sm text-slate-800"
                    value={bloqueioVetId || profissionais[0].id}
                    onChange={(e) => setBloqueioVetId(e.target.value)}
                  >
                    {profissionais.map((p) => (
                      <option key={p.id} value={p.id}>
                        {`${p.nome} ${p.sobrenome}`.trim()}
                      </option>
                    ))}
                  </select>
                </label>
                <BloqueiosLista
                  key={bloqueioVetId || profissionais[0].id}
                  scope={{ tipo: "clinica", veterinarioId: bloqueioVetId || profissionais[0].id }}
                  defaultDate={moment(selectedDate).format("YYYY-MM-DD")}
                  onAppointmentsCancelled={() => {
                    carregarEstatisticas();
                    carregarConsultasPorData(selectedDate);
                    carregarEventosCalendario(currentDate);
                  }}
                />
              </div>
            )}

            <div className="mt-4">
              <PainelRecebidos />
            </div>

            {/* Resumo de Consultas */}
            <div className={styles.appointmentsCard}>
              <div className={styles.appointmentsHeader}>
                <h2 className={styles.cardTitle} style={{ marginBottom: 0 }}>Visão Geral das consultas</h2>
                <span style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 600 }}>
                  {view === 'month' ? (
                    moment(currentDate).format('MMMM YYYY').charAt(0).toUpperCase() + moment(currentDate).format('MMMM YYYY').slice(1)
                  ) : 'Período Atual'}
                </span>
              </div>

              <div className={styles.statsGrid}>
                <div className={`${styles.statItem} ${styles.statItemTotal}`}>
                  <div className={`${styles.statIconWrapper} ${styles.statIconTotal}`}>
                    <CalendarIcon size={16} />
                  </div>
                  <div className={styles.statValue}>{consultationStats.total}</div>
                  <div className={styles.statLabel}>Total</div>
                </div>

                <div className={`${styles.statItem} ${styles.statItemCompleted}`}>
                  <div className={`${styles.statIconWrapper} ${styles.statIconCompleted}`}>
                    <CheckCircle size={18} />
                  </div>
                  <div className={styles.statValue}>{consultationStats.completed}</div>
                  <div className={styles.statLabel}>Realizadas</div>
                </div>

                <div className={`${styles.statItem} ${styles.statItemCancelled}`}>
                  <div className={`${styles.statIconWrapper} ${styles.statIconCancelled}`}>
                    <StatusIcon kind="x" />
                  </div>
                  <div className={styles.statValue}>{consultationStats.cancelled}</div>
                  <div className={styles.statLabel}>Canceladas</div>
                </div>
              </div>

              {/* Advanced Stats Row */}
              <div className={`${styles.statsGrid} ${styles.statsGridVertical}`}>
                <div className={styles.statItem}>
                  <div className={styles.statValueSmall}>{consultationStats.averagePerDay}</div>
                  <div className={styles.statLabelSmall}>Média/Dia (dias úteis)</div>
                </div>
                <div className={styles.statItem}>
                  <div className={styles.statValueSmall}>{consultationStats.busiestDay}</div>
                  <div className={styles.statLabelSmall}>Dia + Movimentado</div>
                </div>
                <div className={styles.statItem}>
                  <div className={styles.statValueSmall}>{consultationStats.peakHour}</div>
                  <div className={styles.statLabelSmall}>Horário de Pico</div>
                </div>
              </div>
            </div>

            {/* Seção de Profissionais Cadastrados - replacing Locations */}
            <div className={styles.appointmentsCard} style={{ marginTop: 0 }}>
              <div className={styles.appointmentsHeader}>
                <h2 className={styles.cardTitle}>Profissionais Cadastrados</h2>
              </div>

              {profissionais.length === 0 ? (
                <p style={{ color: '#64748b' }}>Nenhum profissional cadastrado.</p>
              ) : (
                <div className={styles.professionalsList}>
                  {profissionais.map(vet => (
                    <div key={vet.id} className={styles.professionalItem}>
                      <div className={styles.professionalAvatar}>
                        {vet.fotoUrl ? (
                          <img src={vet.fotoUrl} alt={vet.nome} style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
                        ) : (
                          <div style={{ width: '100%', height: '100%', borderRadius: '50%', background: '#cbd5e1', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 'bold' }}>
                            {vet.nome.charAt(0)}
                          </div>
                        )}
                      </div>
                      <div className={styles.professionalInfo}>
                        <div className={styles.professionalName}>{vet.nome} {vet.sobrenome}</div>
                        <div className={styles.professionalEmail}> <Mail className={styles.stethoscope} size={14} /> {vet.email}</div>


                        {vet.crmv && <div className={styles.professionalCrmv}> <Stethoscope className={styles.stethoscope} size={14} />CRMV: {vet.crmv}</div>}

                      </div>

                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>

          {/* Coluna Direita - Próximas Consultas e Comentários */}
          <div className={styles.rightColumn}>

            <div className={styles.appointmentsCard}>
              <div className={styles.appointmentsHeader}>
                <h2 className={styles.cardTitle} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: 0 }}>
                  <Clock size={20} className={styles.metaInfoIcon} />
                  Consultas do dia
                </h2>
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

              {isLoadingConsultas ? (
                <p>Carregando...</p>
              ) : dashboardData.proximasConsultas.length === 0 ? (
                <div style={{ padding: "1rem", color: "#64748b", textAlign: "center" }}>
                  Nenhuma consulta para esta data.
                </div>
              ) : (
                <div className={styles.appointmentsList}>
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
                          const [h, m] = (consulta.horario || "00:00").split(":");
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
                            title: `${consulta.cliente}${consulta.pet ? " • " + consulta.pet : ""}`,
                            start,
                            end,
                            resource: {
                              cliente: consulta.cliente,
                              clienteSobrenome: consulta.clienteSobrenome,
                              tutorTelefone: consulta.tutorTelefone,
                              tutorEmail: consulta.tutorEmail,
                              petId: consulta.petId,
                              pet: consulta.pet,
                              petRaca: consulta.petRaca,
                              petPorte: consulta.petPorte,
                              petEspecie: consulta.petEspecie,
                              veterinario: consulta.veterinario,
                              veterinarioSobrenome: consulta.veterinarioSobrenome,
                              tipo: consulta.tipo,
                              status: consulta.status,
                              observacoes: consulta.observacoes,
                              valor: consulta.valor,
                              horario: consulta.horario,
                              petFotoUrl: consulta.petFotoUrl,
                            },
                          };
                          setSelectedEvent(ev);
                          setIsModalOpen(true);
                        }}
                      >
                        <div className={styles.appointmentDetails}>
                          <div className={styles.appointment}>
                            <div className={styles.appointmentAddressName}>
                              <span>
                                {consulta.veterinario
                                  ? `Dr(a). ${consulta.veterinario} ${consulta.veterinarioSobrenome || ""}`
                                  : "Veterinário não informado"}
                              </span>
                              <span className={styles.consultHour}>{consulta.horario.substring(0, 5)}</span>
                            </div>
                            <div>
                              {consulta.valor !== undefined && consulta.valor !== null && (
                                <div className={styles.metaInfoItem} title="Valor da Consulta">
                                  <span className={styles.priceValue}>
                                    R$ {consulta.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>

                          <div className={styles.detailsConsult}>
                            <div className={styles.detailsConsultTitle}>
                              <span>Detalhes da consulta</span>
                            </div>

                            <div className={styles.appointmentMetaInfos}>
                              <div className={styles.metaInfoItem} title="Cliente">
                                <UserIcon className={styles.metaInfoIcon} size={16} />
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
                                        <span
                                          className={styles.porteBadge}
                                          data-porte={consulta.petPorte.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")}
                                        >
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
                </div>
              )}
            </div>



            {/* Ranking de Veterinários (Novo Bloco) */}
            <div className={styles.appointmentsCard}>
              <div className={styles.appointmentsHeader}>
                <h2 className={styles.cardTitle} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: 0 }}>
                  <TrendingUp size={20} className={styles.metaInfoIcon} />
                  Ranking Semanal
                </h2>
                <span style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 600, background: '#f1f5f9', padding: '4px 10px', borderRadius: '20px' }}>
                  {moment(selectedDate).startOf('week').format('DD/MM')} - {moment(selectedDate).endOf('week').format('DD/MM')}
                </span>
              </div>

              {profissionais.length === 0 ? (
                <div style={{ padding: "1.5rem", color: "#64748b", textAlign: "center", background: "#f8fafc", borderRadius: "12px", border: "1px dashed #e2e8f0" }}>
                  <p style={{ margin: 0 }}>Nenhum profissional cadastrado.</p>
                </div>
              ) : (
                <div className={styles.rankingList}>
                  {rankingVeterinarios.map((vet, index) => (
                    <div key={vet.name} className={styles.rankingItem}>
                      <div className={index < 3 ? styles.rankingPositionTop : styles.rankingPosition}>
                        {index + 1}
                      </div>

                      {vet.photoUrl ? (
                        <img src={vet.photoUrl} alt={vet.name} className={styles.rankingAvatar} />
                      ) : (
                        <div className={styles.rankingAvatarPlaceholder}>
                          {vet.name.charAt(0)}
                        </div>
                      )}

                      <div className={styles.rankingInfo}>
                        <div className={styles.rankingHeader}>
                          <span className={styles.rankingName}>{vet.name}</span>
                          <span className={styles.rankingCount}>{vet.count} {vet.count === 1 ? 'consulta' : 'consultas'}</span>
                        </div>
                        <div className={styles.rankingBarContainer}>
                          <div
                            className={styles.rankingBarFill}
                            style={{ width: `${(vet.count / (rankingVeterinarios[0]?.count || 1)) * 100}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Avaliações Recentes da Clínica */}
            <div className={styles.appointmentsCard}>
              <div className={styles.appointmentsHeader}>
                <h2 className={styles.cardTitle} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: 0 }}>
                  <MessageCircle size={20} className={styles.metaInfoIcon} />
                  Avaliações Recentes
                </h2>
              </div>

              {recentComments.length === 0 ? (
                <div style={{ padding: "1.5rem", color: "#64748b", textAlign: "center", background: "#f8fafc", borderRadius: "12px", border: "1px dashed #e2e8f0" }}>
                  <p style={{ margin: 0 }}>Ainda não há avaliações para a clínica.</p>
                </div>
              ) : (
                <div className={styles.appointmentsList}>
                  {recentComments.slice(0, 5).map((rev: any) => (
                    <div key={rev.id} className={styles.reviewItem}>
                      <div className={styles.reviewHeader}>
                        <strong className={styles.reviewTutorName}>
                          {rev.tutor?.nome ? `${rev.tutor.nome} ${rev.tutor.sobrenome || ''}`.trim() : 'Tutor Anônimo'}
                          {rev.pet?.nome && <span style={{ fontWeight: 400, opacity: 0.7 }}> • {rev.pet.nome}</span>}
                        </strong>
                        <div className={styles.reviewStars}>
                          {[...Array(5)].map((_, i) => (
                            <Star key={i} size={14} fill={i < (rev.estrelasClinica || 0) ? "#fab005" : "none"} stroke={i < (rev.estrelasClinica || 0) ? "none" : "#cbd5e1"} />
                          ))}
                        </div>
                      </div>
                      <p className={styles.reviewText}>
                        {rev.comentarioClinica || <span style={{ fontStyle: 'italic', opacity: 0.5 }}>Sem comentário</span>}
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
              )}
            </div>

          </div>
        </div>
      </div>

      {/* Modal de Detalhes do Evento */}
      {isModalOpen && selectedEvent && (
        <div className={styles.modalOverlay} role="dialog" aria-modal="true" onClick={() => setIsModalOpen(false)}>
          <div className={`${styles.modalCard} ${styles.modalCardLarge}`} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h4 className={styles.modalTitle}>Detalhes da Consulta</h4>
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
                    {((): string => {
                      const s = (selectedEvent.resource?.status || "").toLowerCase();
                      if (s === "pendente" || s === "aguardando") return "Aguardando";
                      if (s === "concluido" || s === "concluida" || s === "realizado") return "Concluída";
                      if (s === "em andamento") return "Em andamento";
                      if (s === "confirmado") return "Confirmado";
                      if (s === "cancelado") return "Cancelado";
                      return selectedEvent.resource?.status || "";
                    })()}
                  </span>
                </div>

                <div className={styles.modalGrid}>
                  <TutorContact
                    nome={selectedEvent.resource?.cliente}
                    sobrenome={selectedEvent.resource?.clienteSobrenome}
                    telefone={selectedEvent.resource?.tutorTelefone}
                    email={selectedEvent.resource?.tutorEmail}
                  />

                  <div className={styles.infoCardSmall}>
                    <UserIcon size={16} className={styles.infoCardIcon} />
                    <div>
                      <span className={styles.infoCardLabel}>Veterinário</span>
                      <span className={styles.infoCardValue}>
                        {selectedEvent.resource?.veterinario} {selectedEvent.resource?.veterinarioSobrenome}
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
                        {selectedEvent.resource?.valor
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

              {/* Seção 2: Perfil do Pet */}
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
                        <span style={{ fontSize: '14px', color: '#333' }}>
                          {selectedEvent.resource?.petEspecie}
                          {selectedEvent.resource?.petRaca ? ` (${selectedEvent.resource.petRaca})` : ""}
                        </span>
                      </div>
                      <div className={styles.petSpecItem}>
                        <Maximize2 size={14} className={styles.specIcon} />
                        <span
                          className={styles.porteBadgeSimple}
                          data-porte={selectedEvent.resource?.petPorte?.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")}
                        >
                          Porte {selectedEvent.resource?.petPorte}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Seção 3: Observações */}
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

              {selectedEvent.resource?.petId && !(selectedEvent.resource.status || "").toLowerCase().startsWith("cancelad") && (
                <div className={styles.modalSection}>
                  <ProntuarioPet
                    key={`prontuario-${selectedEvent.id}`}
                    petId={selectedEvent.resource.petId}
                    petNome={selectedEvent.resource.pet}
                    recolhivel
                  />
                  {STATUS_ENCAMINHAVEL.includes((selectedEvent.resource.status || "").toLowerCase()) ? (
                    <button
                      type="button"
                      onClick={() => setEncaminhando({ id: selectedEvent.id, pet: selectedEvent.resource?.pet })}
                      className="mt-3 inline-flex items-center gap-2 rounded-xl border border-orange-200 bg-orange-50 px-4 py-2 text-sm font-semibold text-orange-700 hover:bg-orange-100"
                    >
                      <Send size={14} /> Encaminhar pet
                    </button>
                  ) : null}
                </div>
              )}
            </div>
            <div className={styles.modalFooter}>
              <button
                className={styles.secondaryButton}
                onClick={() => setIsModalOpen(false)}
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal para Adicionar Veterinário */}
      {isAddVetModalOpen && (
        <div className={styles.modalOverlay} onClick={() => setIsAddVetModalOpen(false)}>
          <div className={styles.modalCard} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3 className={styles.modalTitle}>Vincular Novo Profissional</h3>
              <button
                className={styles.modalClose}
                onClick={() => setIsAddVetModalOpen(false)}
              >
                &times;
              </button>
            </div>
            <div className={styles.modalBody}>
              <p style={{ marginBottom: '1rem', color: '#64748b' }}>
                Pesquise pelo nome ou CRMV do veterinário que deseja vincular à sua clínica.
              </p>
              <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem' }}>
                <input
                  type="text"
                  placeholder="Nome ou CRMV..."
                  className={styles.searchInput}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearchVet()}
                  style={{ flex: 1, padding: '0.75rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}
                />
                <button
                  className={styles.primaryButton}
                  onClick={handleSearchVet}
                  disabled={isSearching || searchTerm.length < 2}
                >
                  {isSearching ? 'Buscando...' : 'Buscar'}
                </button>
              </div>

              <div className={styles.searchResults}>
                {searchResults.length === 0 && !isSearching && searchTerm.length >= 2 && (
                  <p style={{ textAlign: 'center', color: '#94a3b8' }}>Nenhum resultado encontrado.</p>
                )}
                <div style={{ maxHeight: '300px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {searchResults.map(vet => (
                    <div key={vet.id} className={styles.professionalItem} style={{ border: '1px solid #f1f5f9', padding: '0.75rem', borderRadius: '12px' }}>
                      <div className={styles.professionalAvatar}>
                        {vet.fotoUrl ? (
                          <img src={vet.fotoUrl} alt={vet.nome} style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
                        ) : (
                          <div style={{ width: '100%', height: '100%', borderRadius: '50%', background: '#cbd5e1', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 'bold' }}>
                            {vet.nome.charAt(0)}
                          </div>
                        )}
                      </div>
                      <div className={styles.professionalInfo}>
                        <div className={styles.professionalName}>{vet.nome} {vet.sobrenome}</div>
                        {vet.crmv && <div style={{ fontSize: '0.8rem', color: '#64748b' }}>CRMV: {vet.crmv}</div>}
                      </div>
                      <button
                        className={styles.addChipButton}
                        onClick={() => handleAddVet(vet.id)}
                        style={{ padding: '0.5rem 1rem', background: 'var(--primary-color)', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '0.85rem' }}
                      >
                        Vincular
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {encaminhando ? (
        <EncaminharModal
          agendamentoId={encaminhando.id}
          petNome={encaminhando.pet}
          onFechar={() => setEncaminhando(null)}
        />
      ) : null}
    </>
  );
}
