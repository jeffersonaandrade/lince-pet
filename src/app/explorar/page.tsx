"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Star, ExternalLink, ShieldCheck, Check, BadgeCheck, Clock } from "lucide-react";
import SearchBar from "../../components/Home/SearchBar/SearchBar";
import UserImage from "../../components/ui/UserImage/UserImage";
import OnboardingRedirect from "../../components/RouteProtection/OnboardingRedirect";
import { searchVeterinarios } from "../../services/veterinarios/veterinarios";
import styles from "./explorar.module.css";
import { searchClinicas } from "../../services/clinicas/clinicas";
import Skeleton from "../../components/ui/Skeleton/Skeleton";

interface Veterinario {
  id: string;
  nome: string;
  email: string;
  cidade: string;
  estado: string;
  endereco: string;
  especialidades: string[];
  crmv: string;
  bio: string;
  rating: number;
  totalReviews: number;
  // Back-end retorna `fotoUrl`; manter `image` por compatibilidade (ex.: mocks antigos)
  fotoUrl?: string | null;
  image?: string;
  preco: number;
  experiencia: number;
  clinica?: string | null;
  availability: {
    [key: string]: string[];
  };
}

interface Clinica {
  id: string;
  nomeClinica: string;
  endereco: string;
  cidade: string;
  estado: string;
  fotoPerfil?: string | null;
  isVerified: boolean;
  horariosFuncionamento: any;
  rating: number;
  totalReviews: number;
  especialidades?: { nome: string }[];
  sobre?: string | null;
  descricao?: string | null;
}

function ExplorarContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"veterinarios" | "clinicas">(() => {
    const tabParam = searchParams.get("tab");
    return tabParam === "clinicas" ? "clinicas" : "veterinarios";
  });
  const [searchTerm, setSearchTerm] = useState("");
  const [specialtyTerm, setSpecialtyTerm] = useState("");
  const [veterinarios, setVeterinarios] = useState<Veterinario[]>([]);
  const [clinicas, setClinicas] = useState<Clinica[]>([]);
  
  const handleTabChange = (tab: "veterinarios" | "clinicas") => {
    setActiveTab(tab);
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", tab);
    router.replace(`?${params.toString()}`, { scroll: false });
  };

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      const search = searchParams.get("search");
      const specialty = searchParams.get("specialty");
      const location = searchParams.get("location");
      const plans = searchParams.get("plans");

      const filters: any = {};
      if (search) filters.search = search;
      if (specialty) filters.especialidade = specialty;
      if (location) {
        // Tenta separar cidade e estado se estiver no formato "Cidade, UF"
        if (location.includes(",")) {
          const [cidade, estado] = location.split(",").map((s) => s.trim());
          filters.cidade = cidade;
          filters.estado = estado;
        } else {
          filters.cidade = location;
        }
      }
      if (plans) filters.plano = plans;

      // Carregar ambos em paralelo para ser mais rápido
      const [vetsResponse, clinicasResponse] = await Promise.all([
        searchVeterinarios(filters),
        searchClinicas(filters),
      ]);

      let loadedVets = vetsResponse.veterinarios || [];
      const loadedClinicas = Array.isArray(clinicasResponse) ? clinicasResponse : (clinicasResponse.clinicas || []);

      // Se não há veterinários cadastrados, exibir dados de exemplo temporariamente
      if (loadedVets.length === 0) {
        loadedVets = [
          {
            id: "exemplo-1",
            nome: "Dr. João Silva (Exemplo)",
            email: "joao@exemplo.com",
            cidade: "São Paulo",
            estado: "SP",
            endereco: "Rua Exemplo, 123, São Paulo",
            especialidades: ["Clínica Geral", "Cirurgia"],
            crmv: "CRMV-SP 12345",
            bio: "Este é um veterinário de exemplo para testar a interface.",
            preco: 150,
            experiencia: 5,
            rating: 4.8,
            totalReviews: 120,
            availability: {
              segunda: ["09:00", "10:00", "14:00", "15:00"],
              terca: ["09:00", "10:00", "14:00", "15:00"],
              quarta: ["09:00", "10:00"],
              quinta: ["14:00", "15:00", "16:00"],
              sexta: ["09:00", "10:00", "14:00"],
              sabado: [],
              domingo: [],
            },
            clinica: null,
          },
          {
            id: "exemplo-2",
            nome: "Dra. Maria Santos (Exemplo)",
            email: "maria@exemplo.com",
            cidade: "Rio de Janeiro",
            estado: "RJ",
            endereco: "Av. Exemplo, 456, Rio de Janeiro",
            especialidades: ["Dermatologia", "Alergologia"],
            crmv: "CRMV-RJ 67890",
            bio: "Veterinária especializada em dermatologia e alergias.",
            preco: 180,
            experiencia: 8,
            rating: 4.9,
            totalReviews: 89,
            availability: {
              segunda: ["08:00", "09:00", "10:00"],
              terca: ["08:00", "09:00"],
              quarta: ["14:00", "15:00", "16:00"],
              quinta: ["08:00", "09:00", "10:00"],
              sexta: ["08:00", "09:00"],
              sabado: ["08:00", "09:00"],
              domingo: [],
            },
            clinica: "Clínica Pet Care",
          },
        ];
      }

      setVeterinarios(loadedVets);

      // Adicionar ratings e reviews se não vierem do backend
      const mappedClinicas = loadedClinicas.map((c: any) => ({
        ...c,
        rating: c.rating || 0.0,
        totalReviews: c.totalReviews || 0,
      }));
      setClinicas(mappedClinicas);
    } catch (error) {
      console.error("Erro ao carregar dados:", error);
      setError("Erro ao carregar dados. Tente novamente mais tarde.");
      setVeterinarios([]);
      setClinicas([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [searchParams]);

  useEffect(() => {
    setSearchTerm(searchParams.get("search") || "");
    setSpecialtyTerm(searchParams.get("specialty") || "");
    const tabParam = searchParams.get("tab");
    if (tabParam === "clinicas" || tabParam === "veterinarios") {
      setActiveTab(tabParam as "veterinarios" | "clinicas");
    }
  }, [searchParams]);

  const getPageTitle = () => {
    const location = searchParams.get("location");
    if (activeTab === "clinicas") {
      return location ? `Clínicas em ${location}` : "Explorar Clínicas";
    }

    if (location) {
      return `Veterinários em ${location}`;
    } else {
      return "Explorar Veterinários";
    }
  };

  // Mock Clinics Data
  const filteredClinics = clinicas.filter(clinic => {
    const matchesSearch = !searchTerm || clinic.nomeClinica?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesSpecialty = !specialtyTerm || clinic.especialidades?.some(s => s.nome.toLowerCase().includes(specialtyTerm.toLowerCase()));
    return matchesSearch && matchesSpecialty;
  });


  const filteredVeterinarios = veterinarios.filter((vet) => {
    const matchesSearch = !searchTerm || vet.nome.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesSpecialty = !specialtyTerm || vet.especialidades.some((esp) =>
      esp.toLowerCase().includes(specialtyTerm.toLowerCase())
    );

    return matchesSearch && matchesSpecialty;
  });

  const openInMaps = (address: string) => {
    const encodedAddress = encodeURIComponent(address);
    window.open(
      `https://www.google.com/maps/search/?api=1&query=${encodedAddress}`,
      "_blank"
    );
  };

  const redirectToVetProfile = (vetId: string, time?: string) => {
    const url = time
      ? `/veterinario/${vetId}?time=${encodeURIComponent(time)}`
      : `/veterinario/${vetId}`;
    router.push(url);
  };

  const redirectToClinicProfile = (id: string) => {
    router.push(`/clinicas/${id}`);
  }

  const getDayAvailability = (
    date: Date,
    availability: { [key: string]: string[] }
  ) => {
    const dayNames = [
      "domingo",
      "segunda",
      "terca",
      "quarta",
      "quinta",
      "sexta",
      "sabado",
    ];
    const dayName = dayNames[date.getDay()];
    return availability[dayName] || [];
  };

  const AppointmentBooking = ({
    availability,
    vetId,
    preco,
  }: {
    availability: { [key: string]: string[] };
    vetId: string;
    preco: number;
  }) => {
    const today = new Date();
    const todayAvailability = getDayAvailability(today, availability);
    // Neste componente de listagem não permitimos agendamento.
    // Apenas exibimos os horários disponíveis e redirecionamos para o perfil
    // do veterinário quando o usuário clica em um horário.

    const formatDate = (date: Date) => {
      const months = [
        "Jan",
        "Fev",
        "Mar",
        "Abr",
        "Mai",
        "Jun",
        "Jul",
        "Ago",
        "Set",
        "Out",
        "Nov",
        "Dez",
      ];
      const weekdays = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
      return `${weekdays[date.getDay()]}, ${months[date.getMonth()]
        } ${date.getDate()}`;
    };

    // Pegar os primeiros 6 horários disponíveis ou array vazio se não houver
    const availableSlots =
      todayAvailability.length > 0 ? todayAvailability.slice(0, 6) : [];

    // return (
    //   <div className={styles.appointmentBooking}>
    //     <div className={styles.pricingHeader}>
    //       <span className={styles.price}>R${preco}</span>
    //     </div>

    //     <div className={styles.bookingSection}>
    //       <div className={styles.dateHeader}>
    //         <span className={styles.dateText}>{formatDate(today)}</span>
    //       </div>

    //       <div className={styles.bookingBody}>
    //         <div className={styles.slotsContainer}>
    //           {availableSlots.length > 0 ? (
    //             <>
    //               {availableSlots.map((slot, index) => (
    //                 <button
    //                   key={index}
    //                   className={styles.appointmentSlot}
    //                   onClick={() => redirectToVetProfile(vetId, slot)}
    //                 >
    //                   {slot}
    //                 </button>
    //               ))}
    //             </>
    //           ) : (
    //             <div className={styles.noSlotsAvailable}>
    //               Sem horários disponíveis
    //             </div>
    //           )}
    //         </div>

    //         {availableSlots.length > 0 &&
    //           availableSlots.length % 2 === 0 &&
    //           todayAvailability.length > 6 && (
    //             <button
    //               className={styles.moreTimesButtonBelow}
    //               onClick={() => redirectToVetProfile(vetId)}
    //             >
    //               Mais horários
    //             </button>
    //           )}
    //       </div>
    //     </div>
    //   </div>
    // );
  };

  const getClinicStatus = (horarios: any) => {
    if (!horarios) return { status: 'Indisponível', color: 'gray' };

    const diasDaSemana = [
      'domingo', 'segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado'
    ];

    const agora = new Date();
    const diaAtualIndex = agora.getDay(); // 0 a 6
    const chaveDia = diasDaSemana[diaAtualIndex];

    let horariosObj;
    try {
      horariosObj = typeof horarios === 'string' ? JSON.parse(horarios) : horarios;
    } catch (e) {
      console.error("Erro ao processar horários:", e);
      return { status: 'Dados Inválidos', color: 'gray' };
    }

    const horarioHoje = horariosObj?.[chaveDia];

    if (!horarioHoje) {
      return { status: 'Fechado Hoje', color: 'red' };
    }

    let abreStr = '';
    let fechaStr = '';

    // Suporte para string "08:00-18:00"
    if (typeof horarioHoje === 'string' && horarioHoje.includes('-')) {
      [abreStr, fechaStr] = horarioHoje.split('-');

    }
    // Suporte para array ["08:00", "18:00"] (caso venha diferente do esperado)
    else if (Array.isArray(horarioHoje) && horarioHoje.length >= 2) {
      abreStr = horarioHoje[0];
      fechaStr = horarioHoje[horarioHoje.length - 1];

    }
    else {
      return { status: 'Horário Inválido', color: 'gray' };
    }

    const converterParaMinutos = (horaStr: string) => {
      if (!horaStr) return 0;
      const [h, m] = horaStr.split(':').map(Number);
      return (h || 0) * 60 + (m || 0);
    };
    const minutosAgora = agora.getHours() * 60 + agora.getMinutes();
    const minutosAbre = converterParaMinutos(abreStr);
    const minutosFecha = converterParaMinutos(fechaStr);

    // 5. Lógica de Comparação
    if (minutosAgora < minutosAbre) {
      // Ainda não abriu
      return { status: `Fechado • Abre às ${abreStr}`, color: 'red' };
    } else if (minutosAgora >= minutosAbre && minutosAgora < minutosFecha) {
      // Está aberto
      return { status: `Aberto • Fecha às ${fechaStr}`, color: 'green' };
    } else {
      // Já fechou
      return { status: `Fechado`, color: 'red' };
    }
  };

  if (error) {
    return (
      <div className={styles.container}>
        <div className={styles.header}>
          <h1 className={styles.title}>Explorar Veterinários</h1>
          <p className={styles.subtitle}>
            Encontre veterinários especializados perto de você
          </p>
          <SearchBar />
        </div>
        <div className={styles.error}>
          <h3>Ops! Algo deu errado</h3>
          <p>{error}</p>
          <button
            className={styles.retryButton}
            onClick={() => loadData()}
          >
            Tentar novamente
          </button>
        </div>
      </div>
    );
  }

  const renderSkeletons = () => (
    <div className={styles.veterinariosList}>
      {[1, 2, 3, 4].map((item) => (
        <div key={item} className={styles.veterinarioCard} style={{ cursor: 'default' }}>
          <div className={styles.cardContent}>
            <div className={styles.leftColumn}>
              <div className={styles.firstRow}>
                <Skeleton shape="circle" width={120} height={120} />
                <div className={styles.infoColumn}>
                  <div className={styles.nameSection}>
                    <Skeleton width={200} height={24} />
                  </div>
                  <div className={styles.crmv} style={{ marginTop: 8 }}>
                    <Skeleton width={150} height={20} />
                  </div>
                  <div className={styles.rating} style={{ marginTop: 8 }}>
                    <Skeleton width={100} height={20} />
                  </div>
                </div>
              </div>
              <div className={styles.secondRow}>
                <div className={styles.detailsColumn}>
                  <div className={styles.vetBio}>
                    <Skeleton width="100%" height={16} style={{ marginBottom: 8 }} />
                    <Skeleton width="90%" height={16} style={{ marginBottom: 8 }} />
                    <Skeleton width="80%" height={16} />
                  </div>
                  <div className={styles.specialties} style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                    <Skeleton width={100} height={28} borderRadius={16} />
                    <Skeleton width={120} height={28} borderRadius={16} />
                  </div>
                  <div className={styles.addressSection} style={{ marginTop: 16 }}>
                    <Skeleton width="70%" height={20} />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>{getPageTitle()}</h1>
        <p className={styles.subtitle}>
          Encontre veterinários especializados perto de você
        </p>
        <SearchBar />

        <div className={styles.tabsContainer}>
          <button
            className={`${styles.tabButton} ${activeTab === 'veterinarios' ? styles.activeTab : ''}`}
            onClick={() => handleTabChange('veterinarios')}
          >
            Veterinários
          </button>
          <button
            className={`${styles.tabButton} ${activeTab === 'clinicas' ? styles.activeTab : ''}`}
            onClick={() => handleTabChange('clinicas')}
          >
            Clínicas
          </button>
        </div>
      </div>

      <div className={styles.results}>
        <div className={styles.resultsInfo}>
          {loading ? (
             <Skeleton width={200} height={24} />
          ) : (
            <p className={styles.resultsCount}>
              {activeTab === 'veterinarios' ? (
                <>
                  {filteredVeterinarios.length} veterinário
                  {filteredVeterinarios.length !== 1 ? "s" : ""} encontrado
                  {filteredVeterinarios.length !== 1 ? "s" : ""}
                </>
              ) : (
                <>
                  {filteredClinics.length} clínica
                  {filteredClinics.length !== 1 ? "s" : ""} encontrada
                  {filteredClinics.length !== 1 ? "s" : ""}
                </>
              )}
            </p>
          )}
          {!loading && (searchParams.get("search") || searchParams.get("location") || searchParams.get("plans")) && (
            <button
              className={styles.clearFiltersButton}
              onClick={() => router.push("/explorar")}
            >
              Remover todos os filtros
            </button>
          )}
        </div>
      </div>

      {loading ? renderSkeletons() : activeTab === 'veterinarios' ? (
        <div className={styles.veterinariosList}>
          {filteredVeterinarios.map((vet) => (
            <div
              key={vet.id}
              className={styles.veterinarioCard}
              onClick={() => redirectToVetProfile(vet.id)}
            >
              <div className={styles.cardContent}>
                <div className={styles.leftColumn}>
                  <div className={styles.firstRow}>
                    <UserImage
                      src={vet.fotoUrl || vet.image}
                      alt={`Dr(a). ${vet.nome}`}
                      size={120}
                    />

                    <div className={styles.infoColumn}>
                      <div className={styles.nameSection}>
                        <h3 className={styles.vetNome}>{vet.nome}</h3>
                        <div
                          className={styles.verifiedBadge}
                          title="Veterinário com documentos verificados e CRMV válido"
                        >
                          <BadgeCheck
                            size={22}
                            className={styles.verifiedIcon}
                          />
                          {/* <span className={styles.verifiedText}>Verificado</span> */}
                        </div>
                      </div>

                      <div className={styles.crmv}>
                        <span>{vet.crmv}</span>
                      </div>

                      {vet.clinica && (
                        <div className={styles.clinicNameInfo}>
                          <span>{vet.clinica}</span>
                        </div>
                      )}

                      <div className={styles.rating}>
                        <Star
                          className={styles.starIcon}
                          size={14}
                          fill="currentColor"
                        />
                        <span className={styles.ratingValue}>{Number(vet.rating).toFixed(1)}</span>
                        <span className={styles.reviewCount}>
                          ({vet.totalReviews})
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className={styles.secondRow}>
                    <div className={styles.detailsColumn}>
                      <div className={styles.vetBio}>
                        <p>{vet.bio}</p>
                      </div>
                      <div className={styles.specialties}>
                        <span className={styles.specialtyTag}>
                          {vet.especialidades[0]}
                        </span>
                        {vet.especialidades.length > 1 && (
                          <span className={styles.specialtyCount}>
                            +{vet.especialidades.length - 1} especialidades
                          </span>
                        )}
                      </div>

                      <div className={styles.addressSection}>
                        <span className={styles.addressText}>{vet.endereco}</span>
                        <button
                          className={styles.mapsButton}
                          onClick={(e) => {
                            e.stopPropagation();
                            openInMaps(vet.endereco);
                          }}
                        >
                          <ExternalLink size={12} />
                          Mapa
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* <div onClick={(e) => e.stopPropagation()}>
                  <AppointmentBooking
                    availability={vet.availability}
                    vetId={vet.id}
                    preco={vet.preco}
                  />
                </div> */}
              </div>
            </div>
          ))}

          {filteredVeterinarios.length === 0 && (
            <div className={styles.noResults}>
              <h3>Nenhum veterinário encontrado</h3>
              <p>Tente buscar por outros termos ou cidades.</p>
              {(searchParams.get("search") || searchParams.get("location") || searchParams.get("plans")) && (
                <button
                  className={styles.clearFiltersButtonLarge}
                  onClick={() => router.push("/explorar")}
                >
                  Remover todos os filtros
                </button>
              )}
            </div>
          )}
        </div>
      ) : (
        <div className={styles.veterinariosList}>
          {filteredClinics.map((clinic) => (
            <div
              key={clinic.id}
              className={styles.veterinarioCard}
              onClick={() => redirectToClinicProfile(clinic.id)}
            >
              <div className={styles.cardContent}>
                <div className={styles.leftColumn}>
                  <div className={styles.firstRow}>
                    {/* Using UserImage for consistency, utilizing generic avatar/icon logic within it or fallback */}
                    <UserImage
                      src={clinic.fotoPerfil || undefined}
                      alt={clinic.nomeClinica}
                      size={120}
                    />

                    <div className={styles.infoColumn}>
                      <div className={styles.nameSection}>
                        <h3 className={styles.vetNome}>{clinic.nomeClinica}</h3>
                        <div
                          className={styles.verifiedBadge}
                          title="Veterinário com documentos verificados e CRMV válido"
                        >
                          <BadgeCheck
                            size={22}
                            className={styles.verifiedIcon}
                          />
                          {/* <span className={styles.verifiedText}>Verificado</span> */}
                        </div>
                      </div>

                      <div className={styles.clinicStatusBadgeContainer}>
                        {(() => {
                          const statusInfo = getClinicStatus(clinic.horariosFuncionamento);
                          const isAberto = statusInfo.color === 'green';
                          const isIndisponivel = statusInfo.color === 'gray';
                          return (
                            <div
                              className={styles.clinicStatusBadge}
                              style={{
                                backgroundColor: isAberto ? 'var(--primary-light)' : 'var(--secondary)',
                                color: isAberto ? 'var(--primary-dark)' : 'var(--text-muted)',
                                borderColor: isAberto ? 'var(--primary)' : 'var(--border-color)'
                              }}
                            >
                              <Clock size={14} />
                              <span>{statusInfo.status}</span>
                            </div>
                          );
                        })()}
                      </div>

                      <div className={styles.rating}>
                        <Star className={styles.starIcon} size={14} fill="currentColor" />
                        <span className={styles.ratingValue}>{Number(clinic.rating).toFixed(1)}</span>
                        <span className={styles.reviewCount}>({clinic.totalReviews})</span>
                      </div>
                    </div>
                  </div>

                  <div className={styles.secondRow}>
                    <div className={styles.detailsColumn}>
                      {(clinic.descricao || clinic.sobre) && (
                        <div className={styles.vetBio}>
                          <p>{clinic.descricao || clinic.sobre}</p>
                        </div>
                      )}
                      <div className={styles.specialties}>
                        {clinic.especialidades?.map((esp, index) => (
                          <span key={index} className={styles.specialtyTag}>{esp.nome}</span>
                        ))}
                      </div>
                      <div className={styles.addressSection}>
                        <span className={styles.addressText}>{clinic.endereco}</span>
                        <button
                          className={styles.mapsButton}
                          onClick={(e) => {
                            e.stopPropagation();
                            openInMaps(clinic.endereco);
                          }}
                        >
                          <ExternalLink size={12} />
                          Mapa
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

              </div>
            </div>
          ))}
          {filteredClinics.length === 0 && (
            <div className={styles.noResults}>
              <h3>Nenhuma clínica encontrada</h3>
              <p>Tente buscar por outros termos ou cidades.</p>
              {(searchParams.get("search") || searchParams.get("location") || searchParams.get("plans")) && (
                <button
                  className={styles.clearFiltersButtonLarge}
                  onClick={() => router.push("/explorar")}
                >
                  Remover todos os filtros
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function ExplorarPage() {
  return (
    <OnboardingRedirect>
      <Suspense fallback={null}>
        <ExplorarContent />
      </Suspense>
    </OnboardingRedirect>
  );
}
