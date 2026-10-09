"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Header from "@/components/Header/Header";
import { useAuth } from "@/contexts/AuthContext";
import { FavoritesService } from "@/services/favorites/favorites";
import { getClinicaById } from "@/services/clinicas/clinicas";
import { AgendamentosService } from "@/services/agendamentos/agendamentos";
import { AvaliacoesService } from "@/services/avaliacoes/avaliacoes";
import { formatPhone, abbreviateAddress } from "@/utils/formatters";

import {
  MapPin,
  Phone,
  Clock,
  CheckCircle,
  Star,
  Share2,
  Heart,
  Calendar,
  ExternalLink,
  MessageCircle,
  BadgeCheck,
  Stethoscope,
  ChevronDown,
  ChevronUp,
  Plus,
  AlarmClock,
  User,
  PawPrint
} from "lucide-react";
import styles from "./page.module.css";
import ModalPortal from "@/components/ui/ModalPortal";
import SuccessScreen from "@/components/SuccessScreen/SuccessScreen";
import LottieLoading from "@/components/ui/LottieLoading/LottieLoading";
import { PetsService, type PetRecord } from "@/services/pets/pets";
import MiniCalendar from "@/components/MiniCalendar/MiniCalendar";



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

const getComodidadeLabel = (key: string): string => {
  const comodidade = COMODIDADES_LIST.find(c => c.key === key);
  return comodidade ? comodidade.label : key;
};

export default function ClinicProfilePage({ params: paramsPromise }: { params: Promise<{ id: string }> }) {
  const params = use(paramsPromise);
  const id = params.id;

  const router = useRouter();
  const [clinic, setClinic] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();
  const [isFavorited, setIsFavorited] = useState(false);
  const [favoriteId, setFavoriteId] = useState<string | null>(null);
  const [loadingFavorite, setLoadingFavorite] = useState(false);

  // States for scheduling (REPLICATED FROM VETERINARIO)
  const [selectedDay, setSelectedDay] = useState(0);
  const [selectedTimeSlot, setSelectedTimeSlot] = useState<string | null>(null);
  const [selectedProfessional, setSelectedProfessional] = useState<any>(null);
  const [horariosOcupados, setHorariosOcupados] = useState<string[]>([]);
  const [carregandoDisponibilidade, setCarregandoDisponibilidade] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [customDate, setCustomDate] = useState<string | null>(null);
  const [showAllSlots, setShowAllSlots] = useState(false);

  // Modal State
  const [showAgendamentoModal, setShowAgendamentoModal] = useState(false);
  const [observacoes, setObservacoes] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erroAgendamento, setErroAgendamento] = useState("");
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [pets, setPets] = useState<PetRecord[]>([]);
  const [loadingPets, setLoadingPets] = useState(false);
  const [selectedPetId, setSelectedPetId] = useState<string | null>(null);

  // Helper functions for dates (REPLICATED FROM VETERINARIO)
  const getNextWeek = () => {
    const today = new Date();
    const days = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() + i);
      days.push(date);
    }
    return days;
  };

  const getTodayAtMidnight = () => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  };

  const formatLocalISODate = (date: Date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  };

  const formatDate = (date: Date) => {
    const weekdays = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
    const months = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
    return `${weekdays[date.getDay()]}, ${months[date.getMonth()]} ${date.getDate()}`;
  };

  const setSelectedDateByISO = (isoDate: string) => {
    const today = getTodayAtMidnight();
    const target = new Date(isoDate + "T00:00:00");
    target.setHours(0, 0, 0, 0);
    const diffMs = target.getTime() - today.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    if (diffDays < 0) return;
    setSelectedDay(diffDays);
    setSelectedTimeSlot(null);
    setCustomDate(isoDate);
  };

  const getDayName = (date: Date) => {
    const dayNames = ["domingo", "segunda", "terca", "quarta", "quinta", "sexta", "sabado"];
    return dayNames[date.getDay()];
  };

  const formatPrice = (price: number) => {
    const rounded = Math.round(price * 100) / 100;
    return rounded % 1 === 0
      ? rounded.toFixed(0)
      : rounded.toFixed(2).replace(".", ",");
  };

  const generateTimeSlots = () => {
    const today = new Date();
    const selectedDate = new Date(today);
    selectedDate.setDate(today.getDate() + selectedDay);
    const dayName = getDayName(selectedDate);

    if (selectedProfessional?.specificSchedule) {
      return selectedProfessional.specificSchedule[dayName] || [];
    }

    if (!clinic?.horarios) return [];

    const slots = clinic.horarios[dayName] || [];
    return slots;
  };

  // Initialize selectedDay to today or next available
  useEffect(() => {
    if (clinic?.horarios) {
      const week = getNextWeek();
      for (let i = 0; i < 7; i++) {
        const dayName = getDayName(week[i]);
        if (clinic.horarios[dayName] && clinic.horarios[dayName].length > 0) {
          setSelectedDay(i);
          break;
        }
      }
    }
  }, [clinic?.horarios]);

  const handleProfessionalSelect = (prof: any) => {
    setSelectedProfessional(prof);
    // Scroll to sidebar on mobile if needed
    if (window.innerWidth < 768) {
      const sidebar = document.getElementById('scheduling-card');
      sidebar?.scrollIntoView({ behavior: 'smooth' });
    }
  };


  useEffect(() => {
    async function loadClinic() {
      try {
        const data = await getClinicaById(id);
        const normalizeKeys = (obj: any) => {
          if (!obj) return {};
          let target = obj;
          if (typeof obj === 'string') {
            try { target = JSON.parse(obj); } catch (e) { return {}; }
          }
          const newObj: any = {};
          Object.keys(target).forEach(key => {
            const normalizedKey = key.toLowerCase()
              .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // remove accents
              .replace("-feira", ""); // remove suffix if exists
            newObj[normalizedKey] = target[key];
          });
          return newObj;
        };

        const normalizedHorarios = normalizeKeys(data.horariosFuncionamento);

        let reviewsData = { media: 0, total: 0, avaliacoes: [] as any[] };
        try {
          reviewsData = await AvaliacoesService.listarPorClinica(id);
        } catch (e) {
          console.error("Erro ao puxar avaliações da clínica", e);
        }

        // Mapeamento dos dados do banco para o layout
        const formattedData = {
          ...data,
          name: data.nomeClinica,
          logo: data.fotoPerfil,
          cover: data.fotoCapa || "/img/cover-placeholder.jpg",
          rating: reviewsData.media || 0.0,
          reviewCount: reviewsData.total || 0,
          address: `${abbreviateAddress(data.endereco)}, ${data.cidade} - ${data.estado}`,
          phone: data.telefone ? formatPhone(data.telefone) : "(00) 00000-0000",
          description: data.descricao || "Referência em medicina veterinária na região, cuidando do seu melhor amigo com carinho e excelência.",
          // Formata as especialidades que vêm do preload
          specialties: data.especialidades?.map((e: any) => e.nome) || [],
          // Planos
          planos: data.planos?.map((p: any) => p.name) || [],
          // Diferenciais / Amenities
          amenities: data.comodidades ? (
            typeof data.comodidades === 'string'
              ? Object.keys(JSON.parse(data.comodidades))
                .filter(k => JSON.parse(data.comodidades)[k])
                .map(k => getComodidadeLabel(k))
              : Object.keys(data.comodidades)
                .filter(k => (data.comodidades as any)[k])
                .map(k => getComodidadeLabel(k))
          ) : [
            "Estacionamento",
            "Acessibilidade",
            "Wi-Fi"
          ],
          // Horários (resumo para exibição simples)
          hoursSummary: data.horarioHoje || "Horários não informados",
          horarios: normalizedHorarios,
          professionals: data.veterinarios?.map((v: any) => ({
            id: v.id,
            name: v.user?.nome ? `${v.user.nome} ${v.user.sobrenome || ''}` : 'Veterinário',
            specialty: v.especialidades?.[0]?.nome || "Médico Veterinário",
            crmv: v.crmv || "N/A",
            fotoUrl: v.fotoUrl,
            rating: v.rating || 0.0,
            specificSchedule: v.enderecos?.[0]?.horariosDisponibilidade || null,
            specificPrice: v.enderecos?.[0]?.precoConsulta || null
          })) || [],
          reviews: reviewsData.avaliacoes.map((a: any) => ({
            rating: a.estrelasClinica,
            date: a.data || new Date().toLocaleDateString("pt-BR"),
            userName: a.tutor?.nome ? `${a.tutor.nome} ${a.tutor.sobrenome || ''}`.trim() : "Tutor anônimo",
            comment: a.comentarioClinica,
          })) || []
        };

        setClinic(formattedData);
      } catch (err) {
        console.error("Erro ao carregar clínica:", err);
        setError("Não foi possível carregar os dados da clínica.");
      } finally {
        setLoading(false);
      }
    }
    loadClinic();
  }, [id]);

  // Availability Check (REPLICATED FROM VETERINARIO)
  useEffect(() => {
    const fetchDisponibilidade = async () => {
      // If a professional is selected, check their availability
      // Otherwise, we can't easily check for occupied slots without a specific provider ID
      const providerId = selectedProfessional?.id;
      if (!providerId) {
        setHorariosOcupados([]);
        return;
      }

      const today = new Date();
      const selectedDate = new Date(today);
      selectedDate.setDate(today.getDate() + selectedDay);
      const dataStr = formatLocalISODate(selectedDate);

      try {
        setCarregandoDisponibilidade(true);
        const resp = await AgendamentosService.verificarDisponibilidade(providerId, dataStr);
        setHorariosOcupados(resp.horarios_ocupados || []);
      } catch (e) {
        console.error("Erro ao carregar disponibilidade:", e);
        setHorariosOcupados([]);
      } finally {
        setCarregandoDisponibilidade(false);
      }
    };
    fetchDisponibilidade();
    setShowAllSlots(false); // Reset expansion when day changes
  }, [selectedProfessional?.id, selectedDay]);

  // Load Pets
  useEffect(() => {
    if (user && user.userType === 'tutor' && showAgendamentoModal) {
      setLoadingPets(true);
      PetsService.listarPets()
        .then(res => {
          setPets(res);
          if (res.length > 0) setSelectedPetId(res[0].id);
        })
        .catch(err => console.error("Erro ao carregar pets:", err))
        .finally(() => setLoadingPets(false));
    }
  }, [user, showAgendamentoModal]);

  const handleAgendar = () => {
    if (!user) {
      router.push("/login");
      return;
    }
    setShowAgendamentoModal(true);
  };

  const confirmarAgendamento = async () => {
    if (!selectedPetId || !selectedTimeSlot) {
      setErroAgendamento("Selecione um pet e um horário.");
      return;
    }

    if (!selectedProfessional?.id) {
      setErroAgendamento("Selecione um profissional para o atendimento.");
      return;
    }

    try {
      setSalvando(true);
      setErroAgendamento("");

      const today = new Date();
      const selectedDate = new Date(today);
      selectedDate.setDate(today.getDate() + selectedDay);

      await AgendamentosService.criarAgendamento({
        veterinario_id: selectedProfessional?.id || "",
        data_consulta: formatLocalISODate(selectedDate),
        horario_consulta: selectedTimeSlot,
        tipo_consulta: "presencial", // Default for clinic
        pet_id: selectedPetId,
        observacoes: observacoes || undefined,
        clinica_id: id as string,
      });

      setShowAgendamentoModal(false);
      setShowSuccessModal(true);
    } catch (err: any) {
      setErroAgendamento(err.response?.data?.error || "Erro ao realizar agendamento.");
    } finally {
      setSalvando(false);
    }
  };

  // Check favorite status
  useEffect(() => {
    if (user?.userType === 'tutor' && clinic?.id) {
      FavoritesService.check(undefined, clinic.id)
        .then((res: any) => {
          setIsFavorited(res.isFavorited);
          if (res.favoriteId) setFavoriteId(res.favoriteId);
        })
        .catch(console.error);
    }
  }, [user, clinic?.id]);

  const handleToggleFavorite = async () => {
    if (!user || user.userType !== 'tutor') {
      router.push("/login");
      return;
    }
    if (!clinic) return;

    try {
      setLoadingFavorite(true);
      if (isFavorited && favoriteId) {
        await FavoritesService.remove(favoriteId);
        setIsFavorited(false);
        setFavoriteId(null);
      } else {
        const res = await FavoritesService.add(undefined, clinic.id);
        setIsFavorited(true);
        setFavoriteId(res.id);
      }
    } catch (error) {
      console.error("Erro ao atualizar favorito:", error);
    } finally {
      setLoadingFavorite(false);
    }
  };

  if (loading) {
    return (
      <>
        <Header />
        <div style={{ paddingTop: "100px" }}>
          <LottieLoading />
        </div>
      </>
    );
  }

  if (error || !clinic) {
    return (
      <>
        <Header />
        <div className={styles.container} style={{ display: 'flex', justifyContent: 'center', padding: '100px' }}>
          <p>{error || "Clínica não encontrada."}</p>
        </div>
      </>
    );
  }

  const fullSchedule = (() => {
    if (!clinic?.horarios) return [];

    const daysOrder = ["segunda", "terca", "quarta", "quinta", "sexta", "sabado", "domingo"];
    const dayLabels: Record<string, string> = {
      segunda: "Segunda-feira", terca: "Terça-feira", quarta: "Quarta-feira", quinta: "Quinta-feira",
      sexta: "Sexta-feira", sabado: "Sábado", domingo: "Domingo"
    };

    const weekMap: Record<number, string> = {
      1: "segunda", 2: "terca", 3: "quarta", 4: "quinta", 5: "sexta", 6: "sabado", 0: "domingo"
    };
    const todayKey = weekMap[new Date().getDay()];

    return daysOrder.map((day) => {
      const slots = clinic.horarios[day] || [];
      return {
        dayKey: day,
        label: dayLabels[day],
        slots: slots,
        isToday: day === todayKey,
        isClosed: slots.length === 0
      };
    });
  })();

  return (
    <>
      <Header />
      <main className={styles.container}>
        {/* Cover Section */}
        <div className={styles.coverWrapper}>
          {clinic.cover && clinic.cover !== "/img/cover-placeholder.jpg" ? (
            <Image src={clinic.cover} alt="Capa" fill className={styles.coverImage} style={{ objectFit: 'cover' }} />
          ) : (
            <div className={styles.coverFallback}></div>
          )}
        </div>

        <div className={styles.contentWrapper}>
          {/* Header Info */}
          <section className={styles.headerInfo}>
            <div className={styles.logoWrapper}>
              {clinic.logo ? (
                <Image src={clinic.logo} alt="Logo" width={100} height={100} className={styles.logoImage} />
              ) : (
                <div className={styles.logoFallback}>{clinic.name.charAt(0)}</div>
              )}

            </div>

            <div className={styles.titleSection}>
              <div className={styles.titleRow}>
                <div>
                  <h1>{clinic.name}</h1>
                  <div className={styles.ratingRow}>
                    <Star size={18} fill="#fab005" color="#fab005" />
                    <span>{clinic.rating.toFixed(1)}</span>
                    <span className={styles.reviewCount}>({clinic.reviewCount} avaliações)</span>
                  </div>
                </div>
                <div className={styles.actions}>
                  <button className={styles.actionBtn}><Share2 size={20} /> Compartilhar</button>
                  <button
                    className={styles.actionBtn}
                    onClick={handleToggleFavorite}
                    disabled={loadingFavorite}
                    style={{ minWidth: '100px' }}
                  >
                    <div className={styles.heartWrapper}>
                      <Heart
                        size={20}
                        className={`${styles.baseHeart} ${isFavorited ? styles.heartActive : ''}`}
                      />
                    </div>
                    {isFavorited ? "Salvo" : "Salvar"}
                  </button>
                </div>
              </div>

            </div>
          </section>

          <div className={styles.mainGrid}>
            <div className={styles.leftColumn}>

              {/* About */}
              <section className={styles.section}>
                <h2>Sobre a clínica</h2>
                <p>{clinic.description}</p>
              </section>

              {/* Specialties */}
              {clinic.specialties.length > 0 && (
                <section className={styles.section}>
                  <h2>Especialidades</h2>
                  <div className={styles.specialtiesGrid}>
                    {clinic.specialties.map((spec: string) => (
                      <div key={spec} className={styles.specialtyCard}>
                        <div className={styles.specialtyIcon}>
                          <Stethoscope size={20} />
                        </div>
                        <span>{spec}</span>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* Amenities */}
              {clinic.amenities.length > 0 && (
                <section className={styles.section}>
                  <h2>Estrutura e Diferenciais</h2>
                  <div className={styles.amenitiesGrid}>
                    {clinic.amenities.map((item: string) => (
                      <div key={item} className={styles.amenityItem}>
                        <BadgeCheck size={18} color="#e67e22" />
                        <span>{item}</span>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* Professionals */}
              <section className={styles.section}>
                <h2>Corpo Clínico</h2>
                <div className={styles.profList}>
                  {clinic.professionals && clinic.professionals.length > 0 ? (
                    clinic.professionals.map((prof: any, idx: number) => (
                      <div key={idx} className={styles.profCard}>
                        {prof.fotoUrl ? (
                          <div className={styles.profAvatar} style={{ overflow: 'hidden' }}>
                            <Image src={prof.fotoUrl} alt={prof.name} width={60} height={60} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          </div>
                        ) : (
                          <div className={styles.profAvatar}>{prof.name?.charAt(0) || "V"}</div>
                        )}
                        <div className={styles.profInfo}>
                          <h3>{prof.name}</h3>
                          <span>{prof.specialty}</span>
                          <small>CRMV: {prof.crmv}</small>
                        </div>
                        <div className={styles.profRating}>
                          <Star size={14} fill="#fab005" color="#fab005" />
                          <span>{prof.rating ? prof.rating.toFixed(1) : "0.0"}</span>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p>Agende diretamente com a clínica através dos canais de contato.</p>
                  )}
                </div>
              </section>

              {/* REORGANIZED: Localização e Contato */}
              <section className={styles.section}>
                <h2>Localização e Contato</h2>
                <div className={styles.contactSection}>
                  <div className={styles.contactCard}>
                    <div className={styles.contactIcon}>
                      <MapPin size={24} />
                    </div>
                    <div className={styles.contactInfo}>
                      <h3>Endereço</h3>
                      <p>{clinic.address}</p>
                      <button className={styles.mapsBtn} onClick={() => window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(clinic.address)}`, "_blank")}>
                        <MapPin size={15} />Google Maps
                      </button>
                    </div>
                  </div>

                  <div className={styles.contactCard}>
                    <div className={styles.contactIcon}>
                      <Phone size={24} />
                    </div>
                    <div className={styles.contactInfo}>
                      <h3>Telefone</h3>
                      <p>{clinic.phone}</p>
                      <div style={{ display: 'flex', gap: '10px' }}>
                        <button className={styles.whatsappBtn} onClick={() => window.open(`https://wa.me/${clinic.phone.replace(/\D/g, '')}`, "_blank")}>
                          <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" /></svg>
                          WhatsApp
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </section>

              {/* Health Plans */}
              <section className={styles.section}>
                <h2>Planos de Saúde Atendidos</h2>
                <p style={{ marginBottom: '1.5rem', fontSize: '0.95rem' }}>Esta clínica aceita os seguintes planos de saúde e convênios pet:</p>
                {clinic.planos && clinic.planos.length > 0 ? (
                  <div className={styles.specialtiesGrid}>
                    {clinic.planos.map((plano: string) => (
                      <div key={plano} className={styles.specialtyCard}>
                        <div className={styles.specialtyIcon} style={{ background: '#f8fafc', color: 'var(--primary)' }}>
                          <CheckCircle size={20} />
                        </div>
                        <span>{plano}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p>Nenhum plano de saúde informado ainda.</p>
                )}
              </section>

              {/* Avaliações */}
              <section className={styles.section}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                  <h2>Avaliações</h2>
                  <div className={styles.ratingRow}>
                    <Star size={20} fill="#fab005" color="#fab005" />
                    <span style={{ fontSize: '1.2rem' }}>{clinic.rating.toFixed(1)}</span>
                    <span className={styles.reviewCount}>({clinic.reviewCount} avaliações)</span>
                  </div>
                </div>

                <div className={styles.reviewsList}>
                  {clinic.reviews && clinic.reviews.length > 0 ? (
                    clinic.reviews.map((rev: any, i: number) => (
                      <div key={i} className={styles.reviewCard}>
                        <div className={styles.reviewHeader}>
                          <div className={styles.reviewStars}>
                            <span className={styles.reviewerName}>{rev.userName}</span>
                            {[...Array(5)].map((_, idx) => (
                              <Star key={idx} size={14} fill={idx < rev.rating ? "currentColor" : "none"} stroke={idx < rev.rating ? "none" : "currentColor"} />
                            ))}
                          </div>
                          <span className={styles.reviewDate}>{rev.date}</span>
                        </div>

                        <p className={styles.reviewText}>{rev.comment}</p>
                      </div>
                    ))
                  ) : (
                    <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
                      <p>Esta clínica ainda não possui avaliações detalhadas.</p>
                      <p style={{ fontSize: '0.9rem' }}>A nota média é baseada em atendimentos realizados.</p>
                    </div>
                  )}
                </div>
              </section>
            </div>

            {/* Sidebar / CTA (LITERAL REPLICATION FROM VETERINARIO) */}
            <aside className={styles.sidebar}>
              <div className={styles.stickyCard} id="scheduling-card">
                <h3>Agendar Consulta</h3>

                {!selectedProfessional ? (
                  <div style={{ padding: '0.5rem 0' }}>
                    <p className={styles.selectionPrompt} style={{ fontSize: '0.95rem', color: '#475569', marginBottom: '1rem', lineHeight: '1.5' }}>
                      Para visualizar os horários disponíveis e valores, selecione abaixo um dos especialistas que atendem nesta clínica.
                    </p>

                    <div className={styles.profSelector}>
                      <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>
                        Selecione um especialista:
                      </label>
                      <select
                        className={styles.selectInput}
                        style={{
                          width: '100%',
                          padding: '10px 12px',
                          borderRadius: '8px',
                          border: '1px solid #cbd5e1',
                          fontSize: '0.95rem',
                          color: '#334155',
                          backgroundColor: 'white',
                          cursor: 'pointer',
                          outline: 'none'
                        }}
                        onChange={(e) => {
                          const profId = e.target.value;
                          const prof = clinic.professionals.find((p: any) => p.id === profId);
                          if (prof) handleProfessionalSelect(prof);
                        }}
                        defaultValue=""
                      >
                        <option value="" disabled>Selecione...</option>
                        {clinic.professionals.map((prof: any) => (
                          <option key={prof.id} value={prof.id}>
                            {prof.name} - {prof.specialty}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                ) : (
                  <>
                    <div style={{ marginBottom: '1.5rem', padding: '0.75rem', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <div className={styles.profAvatar} style={{ width: '32px', height: '32px', fontSize: '0.8rem' }}>
                        {selectedProfessional.name?.charAt(0) || "V"}
                      </div>
                      <div style={{ flex: 1 }}>
                        <p style={{ margin: 0, fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>{selectedProfessional.name || "Profissional"}</p>
                        <button
                          onClick={() => setSelectedProfessional(null)}
                          style={{ background: 'none', border: 'none', padding: 0, color: 'var(--primary)', fontSize: '0.75rem', cursor: 'pointer', textDecoration: 'underline' }}
                          className={styles.linkBtn}
                        >
                          Trocar profissional
                        </button>
                      </div>
                    </div>

                    {/* CALENDAR & TIME SLOTS */}
                    <div className={styles.availabilitySection}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: '1rem' }}>
                        <h4 style={{ margin: 0 }}>Disponibilidade</h4>
                        <button
                          type="button"
                          onClick={() => setShowDatePicker((v) => !v)}
                          className={styles.addDateBtn}
                        >
                          <Calendar size={16} /> Data
                        </button>
                      </div>

                      {/* Date Picker Popover */}
                      {showDatePicker && (
                        <div className={styles.datePickerPopover}>
                          <MiniCalendar
                            selectedDate={new Date(new Date().setDate(new Date().getDate() + selectedDay))}
                            onSelect={(isoDate) => {
                              setSelectedDateByISO(isoDate);
                              setShowDatePicker(false);
                            }}
                            onClose={() => setShowDatePicker(false)}
                            minDate={formatLocalISODate(getTodayAtMidnight())}
                          />
                        </div>
                      )}

                      <div className={styles.dateSelection}>
                        {(() => {
                          const list = getNextWeek().map((d, i) => ({ date: d, offset: i }));

                          // If the selected day is beyond the first 7 days, append it
                          if (selectedDay >= 7) {
                            const extraDate = new Date();
                            extraDate.setDate(extraDate.getDate() + selectedDay);
                            list.push({ date: extraDate, offset: selectedDay });
                          }

                          return list
                            .filter(({ date, offset }) => {
                              // Always show the selected day
                              if (offset === selectedDay) return true;

                              // Otherwise show only days with availability
                              const dayName = getDayName(date);
                              if (selectedProfessional?.specificSchedule) {
                                return selectedProfessional.specificSchedule[dayName] && selectedProfessional.specificSchedule[dayName].length > 0;
                              }

                              if (!clinic?.horarios) return false;
                              return clinic.horarios[dayName] && clinic.horarios[dayName].length > 0;
                            })
                            .map(({ date, offset }) => (
                              <div key={offset}
                                className={`${styles.dateOption} ${offset === selectedDay ? styles.selected : ""}`}
                                onClick={() => setSelectedDay(offset)}
                              >
                                <span className={styles.dayName}>{formatDate(date).split(",")[0]}</span>
                                <span className={styles.dayNumber}>{date.getDate()}</span>
                              </div>
                            ));
                        })()}
                      </div>

                      <div className={styles.timeSlots}>
                        {carregandoDisponibilidade ? (
                          <div className={styles.noAvailability}><p>Carregando...</p></div>
                        ) : generateTimeSlots().length > 0 ? (
                          <>
                            {/* Resolvido: Tipagem explícita 'time: string' para evitar erro de implicit any no build */}
                            {generateTimeSlots()
                              .slice(0, showAllSlots ? undefined : 6)
                              .map((time: string, index: number) => (
                                <button key={index}
                                  className={`${styles.timeSlot} ${selectedTimeSlot === time ? styles.active : ""}`}
                                  disabled={horariosOcupados.includes(time)}
                                  onClick={() => setSelectedTimeSlot(time)}
                                >{time}</button>
                              ))}
                            {generateTimeSlots().length > 6 && (
                              <button
                                className={styles.moreTimesBtn}
                                onClick={() => setShowAllSlots(!showAllSlots)}
                              >
                                {showAllSlots ? (
                                  <>Menos <ChevronUp size={16} /></>
                                ) : (
                                  <>Mais ({generateTimeSlots().length - 6}) <ChevronDown size={16} /></>
                                )}
                              </button>
                            )}
                          </>
                        ) : <p className={styles.noAvailability}>Sem horários</p>}
                      </div>
                    </div>

                    <div className={styles.pricingInfo}>
                      <div className={styles.pricing}>
                        <span className={styles.discountPrice}>R${formatPrice(selectedProfessional?.specificPrice || clinic?.preco || 150)}</span>
                        <span className={styles.promoText}>Valor da consulta</span>
                      </div>
                    </div>

                    <button className={styles.bookButton} onClick={handleAgendar} disabled={!selectedTimeSlot}>
                      Agendar
                    </button>
                  </>
                )}
              </div>
            </aside>
          </div>
        </div>
      </main >

      {/* Modals (REPLICATED FROM VETERINARIO) */}
      {
        showAgendamentoModal && (
          <ModalPortal>
            <div className={styles.modalOverlay} onClick={() => setShowAgendamentoModal(false)}>
              <div className={styles.agendamento} onClick={(e) => e.stopPropagation()}>
                <h2>Confirmar Agendamento</h2>
                {erroAgendamento && <div className={styles.error} style={{ color: 'red', marginBottom: '10px' }}>{erroAgendamento}</div>}
                <div className={styles.scrollableContent}>
                  <div className={styles.summarySection}>
                    <div className={styles.summaryHeader}>Você está agendando com</div>
                    <div className={styles.summaryGrid}>
                      <div>
                        <div className={styles.providerRow}><User color="#e67e22" size={18} /> {selectedProfessional?.name || clinic.name}</div>
                        <div className={styles.tags}>
                          <span className={styles.chip}>
                            <Calendar color="#e67e22" size={16} />
                            {(() => {
                              const d = new Date();
                              d.setDate(d.getDate() + selectedDay);
                              return d.toLocaleDateString("pt-BR");
                            })()}
                          </span>
                          <span className={styles.chip}><AlarmClock color="#e67e22" size={16} /> {selectedTimeSlot}</span>
                        </div>
                      </div>
                      <div className={styles.priceBlock}>
                        <div className={styles.price}>R$ {formatPrice(selectedProfessional?.specificPrice || clinic?.preco || 150)}</div>
                      </div>
                    </div>
                  </div>

                  <div style={{ marginBottom: '1.5rem' }}>
                    <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', marginBottom: '8px' }}>Seu Pet</label>
                    {!loadingPets && pets.length > 0 ? (
                      <div className={styles.petSelectGrid} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '12px' }}>
                        {pets.map(p => (
                          <button
                            key={p.id}
                            type="button"
                            style={{
                              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px',
                              border: `1.5px solid ${selectedPetId === p.id ? 'var(--primary)' : '#e5e7eb'}`,
                              borderRadius: '12px', padding: '12px 8px', background: selectedPetId === p.id ? '#fff7ed' : '#fff',
                              cursor: 'pointer', transition: 'all 0.2s'
                            }}
                            onClick={() => setSelectedPetId(p.id)}
                          >
                            <div style={{ width: '56px', height: '56px', borderRadius: '10px', overflow: 'hidden', backgroundColor: '#f1f5f9' }}>
                              {p.foto_url ? (
                                <Image src={p.foto_url} alt={p.nome} width={64} height={64} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                              ) : (
                                <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                  <PawPrint size={24} color="var(--primary)" />
                                </div>
                              )}
                            </div>
                            <span style={{ fontSize: '13px', fontWeight: '600', color: '#374151' }}>{p.nome}</span>
                          </button>
                        ))}
                      </div>
                    ) : <p style={{ fontSize: '14px', color: '#64748b' }}>Nenhum pet encontrado.</p>}
                  </div>

                  <div style={{ marginBottom: '1.5rem' }}>
                    <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', marginBottom: '8px' }}>Observações (opcional)</label>
                    <textarea
                      style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #ddd', minHeight: '80px', fontSize: '14px' }}
                      value={observacoes}
                      onChange={(e) => setObservacoes(e.target.value)}
                      placeholder="Ex: Minha primeira consulta, pet está com tosse..."
                    />
                  </div>
                </div>
                <button
                  className={styles.bookButton}
                  onClick={confirmarAgendamento}
                  disabled={salvando}
                >
                  {salvando ? "Processando..." : "Confirmar Agendamento"}
                </button>
              </div>
            </div>
          </ModalPortal>
        )
      }

      {
        showSuccessModal && (
          <ModalPortal>
            <div className={styles.modalOverlay} onClick={() => setShowSuccessModal(false)}>
              <SuccessScreen onButtonClick={() => setShowSuccessModal(false)} />
            </div>
          </ModalPortal>
        )
      }

    </>
  );
}

