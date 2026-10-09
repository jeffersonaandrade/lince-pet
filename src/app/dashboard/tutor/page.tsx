"use client";

import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import styles from "./tutor.module.css";
import { AppointmentItem } from "./AppointmentItem";
import { Pencil, Trash2, MapPin, Stethoscope, Dog, User as UserIcon, Calendar, History, Star, Clock, ClipboardList, Send } from "lucide-react";
import ProntuarioPet from "@/components/Prontuario/ProntuarioPet";
import EncaminhamentosTutor from "@/components/Encaminhamento/EncaminhamentosTutor";
import {
  AgendamentosService,
  ListaAgendamentosResponse,
} from "@/services/agendamentos/agendamentos";
import { PetsService } from "@/services/pets/pets";
import { AvaliacoesService } from "@/services/avaliacoes/avaliacoes";
import { TutorService } from "@/services/tutor/tutor";
import { ImageEditor } from "@/components/ImageEditor/ImageEditor";
import ProfileImageUploader from "@/components/ProfileImageUploader/ProfileImageUploader";
import { FavoritesList } from "./FavoritesList";
import { getVeterinarioById } from "@/services/veterinarios/veterinarios";
import LottieLoading from "@/components/ui/LottieLoading/LottieLoading";
import Image from "next/image";
import Link from "next/link";

type Pet = {
  id: number | string;
  nome: string;
  especie: string;
  raca?: string;
  idade?: number;
  porte?: 'pequeno' | 'medio' | 'grande';
  foto_url?: string | null;
};

// Espécies disponíveis
const ESPECIES = [
  { value: "Canina", label: "Canina" },
  { value: "Felina", label: "Felina" },
  { value: "Ave", label: "Ave" },
  { value: "Roedor", label: "Roedor" },
  { value: "Réptil", label: "Réptil" },
  { value: "Coelho", label: "Coelho" },
  { value: "Outro", label: "Outro" },
];

// Raças por espécie
const RACAS_POR_ESPECIE: Record<string, { value: string; label: string }[]> = {
  Canina: [
    { value: "Labrador", label: "Labrador" },
    { value: "Golden Retriever", label: "Golden Retriever" },
    { value: "Pastor Alemão", label: "Pastor Alemão" },
    { value: "Bulldog", label: "Bulldog" },
    { value: "Poodle", label: "Poodle" },
    { value: "Beagle", label: "Beagle" },
    { value: "Rottweiler", label: "Rottweiler" },
    { value: "Yorkshire", label: "Yorkshire" },
    { value: "Boxer", label: "Boxer" },
    { value: "Dachshund", label: "Dachshund" },
    { value: "Shih Tzu", label: "Shih Tzu" },
    { value: "Pug", label: "Pug" },
    { value: "Husky Siberiano", label: "Husky Siberiano" },
    { value: "Chihuahua", label: "Chihuahua" },
    { value: "Border Collie", label: "Border Collie" },
    { value: "Vira-lata", label: "Vira-lata" },
    { value: "SRD (Sem Raça Definida)", label: "SRD (Sem Raça Definida)" },
    { value: "Outro", label: "Outro" },
  ],
  Felina: [
    { value: "Persa", label: "Persa" },
    { value: "Siamês", label: "Siamês" },
    { value: "Maine Coon", label: "Maine Coon" },
    { value: "Ragdoll", label: "Ragdoll" },
    { value: "Bengal", label: "Bengal" },
    { value: "Sphynx", label: "Sphynx" },
    { value: "British Shorthair", label: "British Shorthair" },
    { value: "Abissínio", label: "Abissínio" },
    { value: "Scottish Fold", label: "Scottish Fold" },
    { value: "Angorá", label: "Angorá" },
    { value: "Vira-lata", label: "Vira-lata" },
    { value: "SRD (Sem Raça Definida)", label: "SRD (Sem Raça Definida)" },
    { value: "Outro", label: "Outro" },
  ],
  Ave: [
    { value: "Calopsita", label: "Calopsita" },
    { value: "Periquito", label: "Periquito" },
    { value: "Papagaio", label: "Papagaio" },
    { value: "Canário", label: "Canário" },
    { value: "Agapornis", label: "Agapornis" },
    { value: "Cacatua", label: "Cacatua" },
    { value: "Arara", label: "Arara" },
    { value: "Outro", label: "Outro" },
  ],
  Roedor: [
    { value: "Hamster", label: "Hamster" },
    { value: "Porquinho-da-índia", label: "Porquinho-da-índia" },
    { value: "Chinchila", label: "Chinchila" },
    { value: "Rato", label: "Rato" },
    { value: "Gerbil", label: "Gerbil" },
    { value: "Outro", label: "Outro" },
  ],
  Réptil: [
    { value: "Iguana", label: "Iguana" },
    { value: "Jabuti", label: "Jabuti" },
    { value: "Tartaruga", label: "Tartaruga" },
    { value: "Gecko", label: "Gecko" },
    { value: "Cobra", label: "Cobra" },
    { value: "Camaleão", label: "Camaleão" },
    { value: "Outro", label: "Outro" },
  ],
  Coelho: [
    { value: "Mini Lion", label: "Mini Lion" },
    { value: "Angorá", label: "Angorá" },
    { value: "Rex", label: "Rex" },
    { value: "Holandês", label: "Holandês" },
    { value: "Fuzzy Lop", label: "Fuzzy Lop" },
    { value: "SRD (Sem Raça Definida)", label: "SRD (Sem Raça Definida)" },
    { value: "Outro", label: "Outro" },
  ],
  Outro: [
    { value: "Não especificado", label: "Não especificado" },
  ],
};

const PORTE_OPCOES = [
  { value: "pequeno", label: "Pequeno" },
  { value: "medio", label: "Médio" },
  { value: "grande", label: "Grande" },
];

export default function TutorDashboard() {
  const { user, loading, updateUser } = useAuth();
  const router = useRouter();

  const [pets, setPets] = useState<Pet[]>([]);
  const [isSavingPet, setIsSavingPet] = useState(false);
  const [isPetModalOpen, setIsPetModalOpen] = useState(false);
  const [prontuarioPet, setProntuarioPet] = useState<{ id: string; nome: string } | null>(null);
  const [form, setForm] = useState<{
    nome: string;
    especie: string;
    raca: string;
    idade: string;
    porte: string;
  }>({ nome: "", especie: "", raca: "", idade: "", porte: "" });
  const [formError, setFormError] = useState<string | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [editingPetId, setEditingPetId] = useState<number | string | null>(null);

  const [historico, setHistorico] = useState<
    ListaAgendamentosResponse["agendamentos"]
  >([]);
  const [loadingHistorico, setLoadingHistorico] = useState(true);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement | null>(null);

  // Estado para editor de imagem do perfil (REMOVIDO - agora via ProfileImageUploader)
  // const [isProfileImageEditorOpen, setIsProfileImageEditorOpen] = useState(false);
  // const [profileImageToEdit, setProfileImageToEdit] = useState<string | null>(null);

  // Estado para editor de imagem do pet
  const [isPetImageEditorOpen, setIsPetImageEditorOpen] = useState(false);
  const [petImageToEdit, setPetImageToEdit] = useState<string | null>(null);

  // Estado para avaliação
  const [isRatingModalOpen, setIsRatingModalOpen] = useState(false);
  const [ratingAgendamentoId, setRatingAgendamentoId] = useState<string | null>(null);
  const [ratingAgendamento, setRatingAgendamento] = useState<any | null>(null);
  const [ratingStars, setRatingStars] = useState<number>(0);
  const [ratingHoverStars, setRatingHoverStars] = useState<number>(0);
  const [ratingComment, setRatingComment] = useState<string>("");
  const [ratingError, setRatingError] = useState<string | null>(null);
  const [ratingClinicaId, setRatingClinicaId] = useState<string | null>(null);
  const [ratingStarsClinica, setRatingStarsClinica] = useState<number>(0);
  const [ratingHoverStarsClinica, setRatingHoverStarsClinica] = useState<number>(0);
  const [ratingCommentClinica, setRatingCommentClinica] = useState<string>("");
  const [isSubmittingRating, setIsSubmittingRating] = useState(false);
  const [agendamentosAvaliados, setAgendamentosAvaliados] = useState<
    Record<string, boolean>
  >({});

  // Estado para reagendamento
  const [isRescheduleModalOpen, setIsRescheduleModalOpen] = useState(false);
  const [rescheduleAgendamentoId, setRescheduleAgendamentoId] = useState<string | null>(null);
  const [rescheduleAgendamento, setRescheduleAgendamento] = useState<any | null>(null);
  const [rescheduleDate, setRescheduleDate] = useState<string>("");
  const [rescheduleTime, setRescheduleTime] = useState<string>("");
  const [rescheduleError, setRescheduleError] = useState<string | null>(null);
  const [isSubmittingReschedule, setIsSubmittingReschedule] = useState(false);
  const [rescheduleVetConfigs, setRescheduleVetConfigs] = useState<any>(null);
  const [rescheduleVetAvailableSlots, setRescheduleVetAvailableSlots] = useState<string[]>([]);
  const [loadingRescheduleSlots, setLoadingRescheduleSlots] = useState(false);

  const localKey = useMemo(
    () => (user ? `pets_${user.id}` : "pets_anon"),
    [user]
  );

  const upcomingAppointments = useMemo(() => {
    return historico.filter((a) => {
      const s = (a.status || "").toLowerCase();
      // Upcoming: apenas 'pendente' conforme solicitado
      return s === "pendente"; // || s === "confirmado" || s === "em andamento";
    });
  }, [historico]);

  const pastAppointments = useMemo(() => {
    return historico.filter((a) => {
      const s = (a.status || "").toLowerCase();
      // History: concluido, cancelado, reagendado
      return (
        s === "concluido" ||
        s === "concluida" ||
        s === "realizado" ||
        s === "cancelado" ||
        s === "reagendado"
      );
    });
  }, [historico]);

  const carregarHistorico = async () => {
    try {
      setLoadingHistorico(true);
      const res = await AgendamentosService.listarAgendamentos();
      setHistorico(res.agendamentos);
      // Pré-popula mapa de agendamentos avaliados com base no backend
      const preMap: Record<string, boolean> = {};
      res.agendamentos.forEach((a) => {
        if ((a as any).avaliado) preMap[a.id] = true;
      });
      setAgendamentosAvaliados(preMap);
    } catch (e) {
      console.error("Erro ao carregar histórico:", e);
    } finally {
      setLoadingHistorico(false);
    }
  };

  const handleCancelAppointment = async (id: string) => {
    if (!confirm("Tem certeza que deseja cancelar esta consulta?")) return;
    try {
      await AgendamentosService.cancelarAgendamento(id);
      // Atualiza localmente para refletir a mudança
      setHistorico((prev) =>
        prev.map((app) =>
          app.id === id ? { ...app, status: "cancelado" } : app
        )
      );
    } catch (error: any) {
      alert(error.message || "Erro ao cancelar agendamento");
    }
  };

  useEffect(() => {
    if (loading) return;

    if (!user) {
      router.push("/login");
      return;
    }
    if (user.userType !== "tutor") {
      router.push("/");
      return;
    }

    (async () => {
      try {
        const list = await PetsService.listarPets();
        setPets(list as unknown as Pet[]);
      } catch (e) {
        try {
          const raw =
            typeof window !== "undefined"
              ? localStorage.getItem(localKey)
              : null;
          if (raw) setPets(JSON.parse(raw));
        } catch { }
      }
    })();

    carregarHistorico();
  }, [user, loading, router, localKey]);

  // Carrega as configurações do veterinário ao abrir o modal de reagendamento
  useEffect(() => {
    if (!rescheduleAgendamento || !isRescheduleModalOpen) return;

    // reset do estado antigo
    setRescheduleVetConfigs(null);
    setRescheduleVetAvailableSlots([]);

    const fetchVetInfo = async () => {
      try {
        const vetId = rescheduleAgendamento.veterinario?.id;
        if (!vetId) return;
        const res = await getVeterinarioById(vetId);
        setRescheduleVetConfigs(res.veterinario);
      } catch (e) {
        console.error("Erro ao carregar configurações do veterinário:", e);
      }
    };
    fetchVetInfo();
  }, [rescheduleAgendamento, isRescheduleModalOpen]);

  // Checa disponibilidade local ao mudar a data de reagendamento
  useEffect(() => {
    if (!rescheduleVetConfigs || !rescheduleDate || !rescheduleAgendamento) {
      setRescheduleVetAvailableSlots([]);
      return;
    }

    const fetchSlots = async () => {
      setLoadingRescheduleSlots(true);
      try {
        let availability: Record<string, string[]> = {};

        const normalizeKeys = (obj: any) => {
          if (!obj) return {};
          const newObj: any = {};
          Object.keys(obj).forEach(key => {
            const normalizedKey = key.toLowerCase()
              .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
              .replace("-feira", "");
            newObj[normalizedKey] = obj[key];
          });
          return newObj;
        };

        if (rescheduleAgendamento.tipo_consulta === "online") {
          availability = normalizeKeys(rescheduleVetConfigs.horariosOnline || rescheduleVetConfigs.horarios_online || rescheduleVetConfigs.availability || {});
        } else if (rescheduleAgendamento.clinica_id && rescheduleVetConfigs.locations) {
          const loc = rescheduleVetConfigs.locations.find((l: any) => String(l.id) === String(rescheduleAgendamento.clinica_id));
          if (loc) {
            availability = normalizeKeys(loc.availability || rescheduleVetConfigs.availability || {});
          } else {
            availability = normalizeKeys(rescheduleVetConfigs.availability || {});
          }
        } else {
          availability = normalizeKeys(rescheduleVetConfigs.availability || {});
        }

        const dateObj = new Date(rescheduleDate + "T00:00:00");
        const dayNames = ["domingo", "segunda", "terca", "quarta", "quinta", "sexta", "sabado"];
        const dayName = dayNames[dateObj.getDay()];

        const possibleSlots = availability[dayName] || [];

        const vetId = rescheduleAgendamento.veterinario.id;
        const resp = await AgendamentosService.verificarDisponibilidade(vetId, rescheduleDate);
        const ocupados = resp.horarios_ocupados || [];

        let dateStr = rescheduleAgendamento.data_consulta;
        if (dateStr && dateStr.includes('/')) {
          const parts = dateStr.split('/');
          if (parts.length === 3) dateStr = `${parts[2]}-${parts[1]}-${parts[0]}`;
        }

        const bloqueados = resp.horarios_bloqueados || [];
        const finalSlots = resp.dia_bloqueado
          ? []
          : possibleSlots.filter(
              (slot: string) =>
                !ocupados.includes(slot) ||
                (rescheduleDate === dateStr && slot === rescheduleAgendamento.horario_consulta && !bloqueados.includes(slot))
            );

        const sortedSlots = finalSlots.sort((a: string, b: string) => a.localeCompare(b));
        setRescheduleVetAvailableSlots(sortedSlots);

        // Mantém o slot setado vazio se o tempo salvo não existe nas disponiveis daquele dia.
        if (rescheduleTime && !sortedSlots.includes(rescheduleTime)) {
          setRescheduleTime("");
        }

      } catch (e) {
        setRescheduleVetAvailableSlots([]);
      } finally {
        setLoadingRescheduleSlots(false);
      }
    };

    fetchSlots();
  }, [rescheduleVetConfigs, rescheduleDate, rescheduleAgendamento]);

  const salvarPetsLocal = (list: Pet[]) => {
    setPets(list);
    try {
      if (typeof window !== "undefined") {
        localStorage.setItem(localKey, JSON.stringify(list));
      }
    } catch { }
  };

  const validarForm = () => {
    if (!form.nome.trim()) return "Informe o nome do pet";
    if (!form.especie.trim()) return "Informe a espécie";
    if (form.idade && Number.isNaN(Number(form.idade)))
      return "Idade deve ser um número";
    if (!form.porte) return "Informe o porte do animal";
    return null;
  };

  const adicionarPet = async () => {
    const err = validarForm();
    if (err) {
      setFormError(err);
      return;
    }
    setFormError(null);
    setIsSavingPet(true);
    try {
      if (editingPetId) {
        // Edit mode
        const updated = await PetsService.editarPet(String(editingPetId), {
          nome: form.nome.trim(),
          especie: form.especie.trim(),
          raca: form.raca.trim() || undefined,
          idade: form.idade ? Number(form.idade) : undefined,
          porte: form.porte as any,
        });

        if (photoFile) {
          try {
            const newUrl = await PetsService.uploadFoto(String(updated.id), photoFile);
            updated.foto_url = newUrl;
          } catch (e) {
            console.error("Falha ao atualizar foto:", e);
          }
        }

        const updatedPet: Pet = {
          id: updated.id,
          nome: updated.nome,
          especie: updated.especie,
          raca: (updated.raca ?? undefined) as string | undefined,
          idade: (updated.idade ?? undefined) as number | undefined,
          porte: (updated.porte ?? undefined) as any,
          foto_url: updated.foto_url ?? null,
        };

        const novaLista = pets.map(p => p.id === editingPetId ? updatedPet : p);
        setPets(novaLista);
        salvarPetsLocal(novaLista);

      } else {
        // Create mode
        const created = await PetsService.criarPet({
          nome: form.nome.trim(),
          especie: form.especie.trim(),
          raca: form.raca.trim() || undefined,
          idade: form.idade ? Number(form.idade) : undefined,
          porte: form.porte as any,
        });

        let fotoUrl: string | null = null;
        if (photoFile) {
          try {
            fotoUrl = await PetsService.uploadFoto(
              String((created as any).id),
              photoFile
            );
          } catch (e) {
            console.error("Falha ao enviar foto do pet:", e);
          }
        }

        const novo: Pet = {
          id: (created as any).id,
          nome: (created as any).nome,
          especie: (created as any).especie,
          raca: ((created as any).raca ?? undefined) as string | undefined,
          idade: ((created as any).idade ?? undefined) as number | undefined,
          porte: ((created as any).porte ?? undefined) as any,
          foto_url: fotoUrl ?? (created as any).foto_url ?? null,
        };
        const novaLista = [novo, ...pets];
        setPets(novaLista);
        salvarPetsLocal(novaLista);
      }

      setForm({ nome: "", especie: "", raca: "", idade: "", porte: "" });
      setPhotoFile(null);
      setPhotoPreview(null);
      setEditingPetId(null);
      setIsPetModalOpen(false);
    } finally {
      setIsSavingPet(false);
    }
  };

  const handleDeletePet = async () => {
    if (!editingPetId) return;
    if (!confirm("Tem certeza que deseja excluir este pet?")) return;

    try {
      setIsSavingPet(true);
      await PetsService.excluirPet(String(editingPetId));
      const novaLista = pets.filter(p => p.id !== editingPetId);
      setPets(novaLista);
      salvarPetsLocal(novaLista);
      setIsPetModalOpen(false);
      setEditingPetId(null);
      setForm({ nome: "", especie: "", raca: "", idade: "", porte: "" });
      setPhotoFile(null);
      setPetImageToEdit(null);
    } catch (e: any) {
      alert(e.message || "Erro ao excluir pet");
    } finally {
      setIsSavingPet(false);
    }
  };

  const openEditPet = (pet: Pet) => {
    setEditingPetId(pet.id);
    setForm({
      nome: pet.nome,
      especie: pet.especie,
      raca: pet.raca || "",
      idade: pet.idade ? String(pet.idade) : "",
      porte: pet.porte || ""
    });
    setPhotoPreview(pet.foto_url || null);
    setPhotoFile(null);
    setFormError(null);
    setIsPetModalOpen(true);
  };


  const statusBadge = (status?: string) => {
    const key = (status || "").toLowerCase();
    const cssKey = key.replace(/\s+/g, "-");
    const label =
      key === "concluido" || key === "concluida" || key === "realizado"
        ? "Concluída"
        : key === "em andamento"
          ? "Em andamento"
          : key === "pendente"
            ? "Aguardando"
            : key === "confirmado"
              ? "Confirmado"
              : key === "cancelado"
                ? "Cancelado"
                : status || "";

    return (
      <span
        className={[styles.statusBadge, (styles as any)[`status-${cssKey}`]]
          .filter(Boolean)
          .join(" ")}
      >
        <span className={styles.statusIndicator}></span>
        {label}
      </span>
    );
  };

  if (loading) {
    return (
      <div className={styles.loadingContainer} style={{ minHeight: "100vh", display: "flex", alignItems: "center" }}>
        <LottieLoading />
      </div>
    );
  }

  if (!user || user.userType !== "tutor") return null;

  return (
    <div className={styles.pageWrapper}>
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
                  const bmp = await createImageBitmap(file);
                  const canvas = document.createElement('canvas');
                  canvas.width = bmp.width;
                  canvas.height = bmp.height;
                  const ctx = canvas.getContext('2d');
                  ctx?.drawImage(bmp, 0, 0);

                  const { url } = await TutorService.uploadProfilePhotoFromCanvas(canvas);
                  updateUser({ fotoUrl: url });
                } catch (err) {
                  console.error("Falha ao enviar foto do tutor:", err);
                  alert("Não foi possível salvar a foto. Tente novamente.");
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
              <div>
                <h1 style={{ fontSize: '1.8rem', color: 'var(--text-color)', margin: 0 }}>Olá, {user.nome}!</h1>
                <p style={{ color: '#64748b', marginTop: '0.25rem' }}>
                  Aqui está o seu espaço de tutor
                </p>
              </div>

              {/* Painel à direita com Links de edição */}
              <div className={styles.headerRightPanel}>
                <Link href="/dashboard/tutor/perfil" className={styles.editProfileButton}>
                  Editar Perfil
                </Link>
              </div>
            </div>
          </div>
        </section>

        <div className={styles.mainContent}>
          <div className={styles.leftColumn}>
            <div className={styles.card}>
              <div className={styles.cardHeader}>
                <h2 className={styles.sectionTitle} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Dog size={20} className={styles.metaInfoIcon} />
                  Meus Pets
                </h2>
                <button
                  className={styles.primaryButton}
                  onClick={() => {
                    setEditingPetId(null);
                    setForm({ nome: "", especie: "", raca: "", idade: "", porte: "" });
                    setPhotoPreview(null);
                    setIsPetModalOpen(true);
                  }}
                >
                  + Adicionar Pet
                </button>
              </div>

              <div className={styles.petsList}>
                {pets.length === 0 && (
                  <p className={styles.muted}>Nenhum pet cadastrado ainda.</p>
                )}
                {pets.map((p) => (
                  <div key={p.id} className={styles.petItem}>
                    {(() => {
                      const toCdnUrl = (url?: string | null) => {
                        if (!url) return null;
                        const cdn = process.env.NEXT_PUBLIC_CDN_BASE_URL;
                        try {
                          if (cdn && url.includes(".s3.")) {
                            const u = new URL(url);
                            const base = cdn.startsWith("http")
                              ? cdn
                              : `https://${cdn}`;
                            return `${base.replace(/\/+$/, "")}${u.pathname}`;
                          }
                        } catch { }
                        return url;
                      };
                      const finalUrl = toCdnUrl(p.foto_url);
                      return finalUrl ? (
                         
                        <Image
                          src={finalUrl}
                          alt={p.nome}
                          className={styles.uploaderPreview}
                          width={100}
                          height={100}
                        />
                      ) : (
                        <div className={styles.petAvatar}>
                          {p.nome?.charAt(0)?.toUpperCase()}
                        </div>
                      );
                    })()}
                    <div className={styles.petInfo}>
                      <div className={styles.petName}>{p.nome}</div>
                      <div className={styles.petMeta}>
                        <span>{p.especie}</span>
                        {p.raca && <span>• {p.raca}</span>}
                        {p.porte && (
                          <span>
                            {p.porte}
                          </span>
                        )}
                        {typeof p.idade === "number" && (
                          <span>• {p.idade} ano(s)</span>
                        )}
                      </div>
                    </div>
                    <button
                      type="button"
                      className={styles.actionButtonGhost}
                      onClick={() => setProntuarioPet({ id: String(p.id), nome: p.nome })}
                      title="Ver prontuário"
                      aria-label={`Ver prontuário de ${p.nome}`}
                    >
                      <ClipboardList size={18} />
                    </button>
                    <button
                      className={styles.actionButtonGhost}
                      onClick={() => openEditPet(p)}
                      title="Editar pet"
                    >
                      <Pencil size={18} />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className={styles.card}>
              <h3 className={styles.cardTitle} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <UserIcon size={20} className={styles.metaInfoIcon} />
                Informações do Tutor
              </h3>
              <div className={styles.infoList}>
                <div className={styles.infoItem}>
                  <span className={styles.infoLabel}>Nome</span>
                  <span className={styles.infoValue}>{user.nome}</span>
                </div>
                {user.email && (
                  <div className={styles.infoItem}>
                    <span className={styles.infoLabel}>E-mail</span>
                    <span className={styles.infoValue}>{user.email}</span>
                  </div>
                )}
                {(user.cidade || user.estado) && (
                  <div className={styles.infoItem}>
                    <span className={styles.infoLabel}>Localidade</span>
                    <span className={styles.infoValue}>
                      {[user.cidade, user.estado].filter(Boolean).join(" - ")}
                    </span>
                  </div>
                )}
                {user.createdAt && (
                  <div className={styles.infoItem}>
                    <span className={styles.infoLabel}>Desde</span>
                    <span className={styles.infoValue}>
                      {new Date(user.createdAt).toLocaleDateString("pt-BR")}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* upcoming consultations */}
            <div className={styles.card}>
              <div className={styles.cardHeader}>
                <h2 className={styles.sectionTitle} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Clock size={20} className={styles.metaInfoIcon} />
                  Próximas Consultas
                </h2>
              </div>
              {loadingHistorico && (
                <LottieLoading width={150} height={150} />
              )}
              {!loadingHistorico && upcomingAppointments.length === 0 && (
                <p className={styles.muted}>Nenhuma consulta agendada.</p>
              )}
              <div className={styles.appointmentsList}>
                {upcomingAppointments.map((a) => (
                  <AppointmentItem
                    key={a.id}
                    agendamento={a}
                    statusBadge={statusBadge}
                    onCancel={handleCancelAppointment}
                    onChanged={carregarHistorico}
                    onReschedule={(agendamento) => {
                      setRescheduleAgendamentoId(agendamento.id);
                      setRescheduleAgendamento(agendamento);
                      let dateStr = agendamento.data_consulta;
                      if (dateStr && dateStr.includes('/')) {
                        const parts = dateStr.split('/');
                        if (parts.length === 3) dateStr = `${parts[2]}-${parts[1]}-${parts[0]}`;
                      }
                      // dateStr is now YYYY-MM-DD which is required for input type="date"
                      setRescheduleDate(dateStr || "");
                      setRescheduleTime(agendamento.horario_consulta || "");
                      setRescheduleError(null);
                      setIsRescheduleModalOpen(true);
                    }}
                  />
                ))}
              </div>
            </div>

            <div className={styles.card}>
              <div className={styles.cardHeader}>
                <h2 className={styles.sectionTitle} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Send size={20} className={styles.metaInfoIcon} />
                  Encaminhamentos
                </h2>
              </div>
              <EncaminhamentosTutor />
            </div>
          </div>

          <div className={styles.rightColumn}>
            <div className={styles.card}>
              <div className={styles.cardHeader}>
                <h2 className={styles.sectionTitle} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Star size={20} className={styles.metaInfoIcon} />
                  Meus Favoritos
                </h2>
              </div>
              <FavoritesList />
            </div>

            {/* removal of upcoming consultations from here */}

            <div className={styles.card}>
              <div className={styles.cardHeader}>
                <h2 className={styles.sectionTitle} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <History size={20} className={styles.metaInfoIcon} />
                  Histórico de Consultas
                </h2>
              </div>
              {loadingHistorico && (
                <LottieLoading width={150} height={150} />
              )}
              {!loadingHistorico && pastAppointments.length === 0 && (
                <p className={styles.muted}>Nenhuma consulta no histórico.</p>
              )}
              <div>
                {(() => {
                  const grouped: Record<string, typeof pastAppointments> = {};

                  pastAppointments.forEach((a) => {
                    let year = "Anteriores";
                    if (a.data_consulta) {
                      let dateStr = a.data_consulta;
                      // Handle DD/MM/YYYY
                      if (dateStr.includes('/')) {
                        const parts = dateStr.split('/');
                        if (parts.length === 3) dateStr = `${parts[2]}-${parts[1]}-${parts[0]}`;
                      }
                      const d = new Date(dateStr.includes('T') ? dateStr : dateStr + "T00:00:00");
                      if (!isNaN(d.getTime())) {
                        year = d.getFullYear().toString();
                      }
                    }
                    if (!grouped[year]) grouped[year] = [];
                    grouped[year].push(a);
                  });

                  // Sort years descending (newest first)
                  const sortedYears = Object.keys(grouped).sort((a, b) => {
                    if (a === "Anteriores") return 1;
                    if (b === "Anteriores") return -1;
                    return Number(b) - Number(a);
                  });

                  return sortedYears.map((year) => (
                    <div key={year} style={{ marginBottom: "1.5rem" }}>
                      <h4 className={styles.yearTitle}>{year}</h4>
                      <div className={styles.appointmentsList}>
                        {grouped[year].map((a) => {
                          const key = (a.status || "").toLowerCase();
                          const concluida =
                            key === "concluido" ||
                            key === "concluida" ||
                            key === "realizado";
                          const jaAvaliado =
                            (a as any).avaliado || agendamentosAvaliados[a.id];
                          const canRate = concluida && !jaAvaliado;

                          return (
                            <AppointmentItem
                              key={a.id}
                              agendamento={a}
                              statusBadge={statusBadge}
                              onCancel={handleCancelAppointment}
                              onChanged={carregarHistorico}
                              onReschedule={(agendamento) => {
                                setRescheduleAgendamentoId(agendamento.id);
                                setRescheduleAgendamento(agendamento);
                                let dateStr = agendamento.data_consulta;
                                if (dateStr && dateStr.includes('/')) {
                                  const parts = dateStr.split('/');
                                  if (parts.length === 3) dateStr = `${parts[2]}-${parts[1]}-${parts[0]}`;
                                }
                                setRescheduleDate(dateStr || "");
                                setRescheduleTime(agendamento.horario_consulta || "");
                                setRescheduleError(null);
                                setIsRescheduleModalOpen(true);
                              }}
                              onRate={(agendamento) => {
                                setRatingAgendamentoId(agendamento.id);
                                setRatingAgendamento(agendamento);
                                setRatingClinicaId(agendamento.clinica_id || agendamento.clinica?.id || null);
                                setRatingStars(0);
                                setRatingHoverStars(0);
                                setRatingComment("");
                                setRatingStarsClinica(0);
                                setRatingHoverStarsClinica(0);
                                setRatingCommentClinica("");
                                setRatingError(null);
                                setIsRatingModalOpen(true);
                              }}
                              canRate={canRate}
                              isRated={!!jaAvaliado}
                            />
                          );
                        })}
                      </div>
                    </div>
                  ));
                })()}
              </div>
            </div>
          </div>
        </div>

        {prontuarioPet && (
          <div
            role="dialog"
            aria-modal="true"
            aria-label={`Prontuário de ${prontuarioPet.nome}`}
            className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/50 p-4"
            onClick={() => setProntuarioPet(null)}
          >
            <div
              className="flex max-h-[90vh] w-full max-w-2xl flex-col gap-3 overflow-y-auto rounded-2xl bg-white p-5 shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between gap-2">
                <h3 className="m-0 text-lg font-bold text-slate-800">Prontuário</h3>
                <button
                  type="button"
                  aria-label="Fechar"
                  onClick={() => setProntuarioPet(null)}
                  className="cursor-pointer rounded-lg border-0 bg-transparent px-2 text-2xl leading-none text-slate-500 hover:text-slate-800"
                >
                  &times;
                </button>
              </div>
              <ProntuarioPet petId={prontuarioPet.id} petNome={prontuarioPet.nome} />
            </div>
          </div>
        )}

        {isPetModalOpen && (
          <div className={styles.modalOverlay} role="dialog" aria-modal="true">
            <div className={styles.modalCard}>
              <div className={styles.modalHeader}>
                <h4 className={styles.modalTitle}>
                  {editingPetId ? "Editar Pet" : "Adicionar Pet"}
                </h4>
                <button
                  className={styles.modalClose}
                  aria-label="Fechar"
                  onClick={() => {
                    setIsPetModalOpen(false);
                    setFormError(null);
                  }}
                >
                  ✕
                </button>
              </div>
              <div className={styles.modalBody}>
                <div className={styles.uploader}>
                  {photoPreview ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={photoPreview}
                      alt="Prévia"
                      className={styles.uploaderPreview}
                    />
                  ) : (
                    <div className={styles.uploaderPreview}>Foto</div>
                  )}
                  <div className={styles.uploaderActions}>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0] || null;
                        if (file) {
                          const url = URL.createObjectURL(file);
                          setPhotoFile(file);
                          setPetImageToEdit(url);
                          setIsPetImageEditorOpen(true);
                        }
                      }}
                    />
                  </div>
                </div>

                <div className={styles.formGrid}>
                  <div className={styles.formRow}>
                    <label className={styles.inputLabel}>Nome</label>
                    <input
                      className={styles.input}
                      value={form.nome}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, nome: e.target.value }))
                      }
                      placeholder="Ex.: Luna"
                    />
                  </div>
                  <div className={styles.formRow}>
                    <label className={styles.inputLabel}>Espécie</label>
                    <select
                      className={styles.input}
                      value={form.especie}
                      onChange={(e) => {
                        const novaEspecie = e.target.value;
                        setForm((f) => ({
                          ...f,
                          especie: novaEspecie,
                          // Limpa a raça se mudar de espécie
                          raca: novaEspecie === f.especie ? f.raca : ""
                        }));
                      }}
                    >
                      <option value="">Selecione a espécie</option>
                      {ESPECIES.map((esp) => (
                        <option key={esp.value} value={esp.value}>
                          {esp.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className={styles.formRow}>
                    <label className={styles.inputLabel}>Raça</label>
                    <select
                      className={styles.input}
                      value={form.raca}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, raca: e.target.value }))
                      }
                      disabled={!form.especie}
                    >
                      <option value="">
                        {!form.especie
                          ? "Selecione a espécie primeiro"
                          : "Selecione a raça"}
                      </option>
                      {form.especie && RACAS_POR_ESPECIE[form.especie]?.map((raca) => (
                        <option key={raca.value} value={raca.value}>
                          {raca.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className={styles.formRow}>
                    <label className={styles.inputLabel}>Porte</label>
                    <select
                      className={styles.input}
                      value={form.porte}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, porte: e.target.value }))
                      }
                    >
                      <option value="">Selecione o porte</option>
                      {PORTE_OPCOES.map((p) => (
                        <option key={p.value} value={p.value}>
                          {p.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className={styles.formRow}>
                    <label className={styles.inputLabel}>Idade</label>
                    <input
                      className={styles.input}
                      value={form.idade}
                      inputMode="numeric"
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          idade: e.target.value.replace(/\D+/g, ""),
                        }))
                      }
                      placeholder="Ex.: 3"
                    />
                  </div>
                  {formError && (
                    <div className={styles.errorRow}>{formError}</div>
                  )}
                </div>
              </div>
              <div className={styles.modalFooter}>
                <button
                  className={styles.secondaryButton}
                  onClick={() => setIsPetModalOpen(false)}
                >
                  Cancelar
                </button>
                {editingPetId && (
                  <button
                    type="button"
                    className={styles.dangerButton}
                    onClick={handleDeletePet}
                    disabled={isSavingPet}
                  >
                    Excluir
                  </button>
                )}
                <button
                  className={styles.primaryButton}
                  onClick={adicionarPet}
                  disabled={isSavingPet}
                >
                  {isSavingPet ? "Salvando..." : "Salvar Pet"}
                </button>
              </div>
            </div>
          </div>
        )}

        {isRatingModalOpen && (
          <div className={styles.modalOverlay} role="dialog" aria-modal="true">
            <div className={styles.modalCard}>
              <div className={styles.modalHeader}>
                <h4 className={styles.modalTitle}>Avaliar atendimento</h4>
                <button
                  className={styles.modalClose}
                  aria-label="Fechar"
                  onClick={() => setIsRatingModalOpen(false)}
                >
                  ✕
                </button>
              </div>
              <div className={styles.modalBody} style={{ padding: '0.5rem 1.25rem' }}>
                {ratingAgendamento && (
                  <>
                    <div className={styles.ratingSection}>
                      <div className={styles.ratingEntityHeader}>
                        {(ratingAgendamento.veterinario ?? ratingAgendamento.prestador)?.fotoUrl ? (
                          <img
                            src={(ratingAgendamento.veterinario ?? ratingAgendamento.prestador).fotoUrl}
                            alt={(ratingAgendamento.veterinario ?? ratingAgendamento.prestador)?.nome}
                            className={styles.ratingEntityAvatar}
                          />
                        ) : (
                          <div className={styles.ratingEntityAvatar}>{((ratingAgendamento.veterinario ?? ratingAgendamento.prestador)?.nome?.charAt(0) || 'P').toUpperCase()}</div>
                        )}
                        <div className={styles.ratingEntityInfo}>
                          <h5 className={styles.ratingEntityName}>
                            {ratingAgendamento.prestador
                              ? `${ratingAgendamento.prestador.nome} ${ratingAgendamento.prestador.sobrenome || ''}`
                              : `Dr(a). ${ratingAgendamento.veterinario?.nome} ${ratingAgendamento.veterinario?.sobrenome || ''}`}
                          </h5>
                          <div className={styles.ratingEntitySubtitle}>
                            <Stethoscope size={14} /> {ratingAgendamento.prestador?.tipo_servico || 'Veterinário(a)'}
                          </div>
                        </div>
                      </div>

                      <div className={styles.ratingContent}>
                        <div className={styles.ratingHeader}>
                          <div className={styles.ratingStars}>
                            {[1, 2, 3, 4, 5].map((n) => {
                              const filled = n <= (ratingHoverStars || ratingStars);
                              return (
                                <button
                                  key={n}
                                  className={filled ? styles.starSelected : styles.star}
                                  onClick={() => setRatingStars(n)}
                                  onMouseEnter={() => setRatingHoverStars(n)}
                                  onMouseLeave={() => setRatingHoverStars(0)}
                                  aria-label={`${n} estrela${n > 1 ? "s" : ""}`}
                                >
                                  ★
                                </button>
                              );
                            })}
                          </div>
                          <div className={styles.ratingHint}>
                            {ratingStars > 0
                              ? `${ratingStars} de 5 estrelas`
                              : "Selecione as estrelas"}
                          </div>
                        </div>
                        <textarea
                          className={styles.textarea}
                          placeholder="Como foi a experiência com o profissional? (opcional)"
                          value={ratingComment}
                          maxLength={1000}
                          onChange={(e) => setRatingComment(e.target.value)}
                        />
                      </div>
                    </div>

                    {ratingClinicaId && (
                      <div className={styles.ratingSection}>
                        <div className={styles.ratingEntityHeader}>
                          {ratingAgendamento.clinica_foto ? (
                            <img
                              src={ratingAgendamento.clinica_foto}
                              alt={ratingAgendamento.local_nome}
                              className={`${styles.ratingEntityAvatar} ${styles.ratingEntityClinicAvatar}`}
                            />
                          ) : (
                            <div className={`${styles.ratingEntityAvatar} ${styles.ratingEntityClinicAvatar}`}>
                              {(ratingAgendamento.local_nome?.charAt(0) || 'C').toUpperCase()}
                            </div>
                          )}
                          <div className={styles.ratingEntityInfo}>
                            <h5 className={styles.ratingEntityName}>
                              {ratingAgendamento.local_nome || "A Clínica"}
                            </h5>
                            <div className={styles.ratingEntitySubtitle}>
                              <MapPin size={14} /> Espaço e Estrutura
                            </div>
                          </div>
                        </div>

                        <div className={styles.ratingContent}>
                          <div className={styles.ratingHeader}>
                            <div className={styles.ratingStars}>
                              {[1, 2, 3, 4, 5].map((n) => {
                                const filled = n <= (ratingHoverStarsClinica || ratingStarsClinica);
                                return (
                                  <button
                                    key={`clinica-${n}`}
                                    className={filled ? styles.starSelected : styles.star}
                                    onClick={() => setRatingStarsClinica(n)}
                                    onMouseEnter={() => setRatingHoverStarsClinica(n)}
                                    onMouseLeave={() => setRatingHoverStarsClinica(0)}
                                    aria-label={`${n} estrela${n > 1 ? "s" : ""}`}
                                  >
                                    ★
                                  </button>
                                );
                              })}
                            </div>
                            <div className={styles.ratingHint}>
                              {ratingStarsClinica > 0
                                ? `${ratingStarsClinica} de 5 estrelas`
                                : "Selecione as estrelas"}
                            </div>
                          </div>
                          <textarea
                            className={styles.textarea}
                            placeholder="Conte o que achou da estrutura e do serviço do local (opcional)"
                            value={ratingCommentClinica}
                            maxLength={1000}
                            onChange={(e) => setRatingCommentClinica(e.target.value)}
                          />
                        </div>
                      </div>
                    )}
                  </>
                )}

                {ratingError && (
                  <div className={styles.errorRow}>{ratingError}</div>
                )}
              </div>
              <div className={styles.modalFooter}>
                <button
                  className={styles.secondaryButton}
                  onClick={() => setIsRatingModalOpen(false)}
                >
                  Cancelar
                </button>
                <button
                  className={styles.primaryButton}
                  disabled={isSubmittingRating || ratingStars < 1}
                  onClick={async () => {
                    if (!ratingAgendamentoId) return;
                    if (ratingStars < 1) {
                      setRatingError("Selecione de 1 a 5 estrelas para o veterinário");
                      return;
                    }
                    if (ratingClinicaId && ratingStarsClinica < 1) {
                      setRatingError("Selecione de 1 a 5 estrelas para a clínica");
                      return;
                    }
                    setIsSubmittingRating(true);
                    setRatingError(null);
                    try {
                      await AvaliacoesService.criarAvaliacao(
                        ratingAgendamentoId,
                        {
                          estrelas: ratingStars,
                          comentario: ratingComment?.trim() || undefined,
                          estrelasClinica: ratingClinicaId ? ratingStarsClinica : undefined,
                          comentarioClinica: ratingClinicaId ? (ratingCommentClinica?.trim() || undefined) : undefined,
                        }
                      );
                      setAgendamentosAvaliados((m) => ({
                        ...m,
                        [ratingAgendamentoId]: true,
                      }));
                      setIsRatingModalOpen(false);
                    } catch (e: any) {
                      setRatingError(e?.message || "Falha ao enviar avaliação");
                    } finally {
                      setIsSubmittingRating(false);
                    }
                  }}
                >
                  {isSubmittingRating ? "Enviando..." : "Enviar avaliação"}
                </button>
              </div>
            </div>
          </div>
        )}

        {isRescheduleModalOpen && (
          <div className={styles.modalOverlay} role="dialog" aria-modal="true">
            <div className={styles.modalCard}>
              <div className={styles.modalHeader}>
                <h4 className={styles.modalTitle}>Reagendar Consulta</h4>
                <button
                  className={styles.modalClose}
                  aria-label="Fechar"
                  onClick={() => setIsRescheduleModalOpen(false)}
                >
                  ✕
                </button>
              </div>
              <div className={styles.modalBody}>
                <div className={styles.formGrid}>
                  <div className={styles.formRow}>
                    <label className={styles.inputLabel}>Nova Data</label>
                    <input
                      type="date"
                      className={styles.input}
                      value={rescheduleDate}
                      min={new Date().toISOString().split('T')[0]} // Não permite dias anteriores
                      onChange={(e) => setRescheduleDate(e.target.value)}
                    />
                  </div>
                  <div className={styles.formRow}>
                    <label className={styles.inputLabel}>Novo Horário</label>
                    {loadingRescheduleSlots ? (
                      <p className={styles.muted} style={{ fontSize: '0.85rem' }}>Buscando horários disponíveis...</p>
                    ) : rescheduleVetAvailableSlots.length > 0 ? (
                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        {rescheduleVetAvailableSlots.map((time) => (
                          <button
                            key={time}
                            type="button"
                            onClick={() => setRescheduleTime(time)}
                            style={{
                              padding: '0.4rem 0.8rem',
                              border: rescheduleTime === time ? '2px solid #e67e22' : '1px solid #e2e8f0',
                              borderRadius: '6px',
                              background: rescheduleTime === time ? '#fff4eb' : '#fff',
                              color: rescheduleTime === time ? '#d35400' : '#475569',
                              fontWeight: rescheduleTime === time ? 600 : 400,
                              cursor: 'pointer',
                              fontSize: '0.85rem',
                              transition: 'all 0.2s',
                            }}
                          >
                            {time}
                          </button>
                        ))}
                      </div>
                    ) : rescheduleDate ? (
                      <p style={{ color: '#dc2626', fontSize: '0.85rem', margin: 0 }}>Nenhum horário disponível para esta data e/ou local.</p>
                    ) : (
                      <p className={styles.muted} style={{ fontSize: '0.85rem', margin: 0 }}>Selecione uma data primeiro para carregar os horários.</p>
                    )}
                  </div>
                  {rescheduleError && (
                    <div className={styles.errorRow}>{rescheduleError}</div>
                  )}
                </div>
              </div>
              <div className={styles.modalFooter}>
                <button
                  className={styles.secondaryButton}
                  onClick={() => setIsRescheduleModalOpen(false)}
                >
                  Cancelar
                </button>
                <button
                  className={styles.primaryButton}
                  disabled={isSubmittingReschedule || !rescheduleDate || !rescheduleTime}
                  onClick={async () => {
                    if (!rescheduleAgendamentoId) return;
                    if (!rescheduleDate || !rescheduleTime) {
                      setRescheduleError("Selecione a data e o horário");
                      return;
                    }
                    setIsSubmittingReschedule(true);
                    setRescheduleError(null);
                    try {
                      await AgendamentosService.reagendarAgendamento(
                        rescheduleAgendamentoId,
                        rescheduleDate,
                        rescheduleTime
                      );
                      setIsRescheduleModalOpen(false);
                      // Update locally
                      setHistorico((prev) =>
                        prev.map((app) => {
                          if (app.id === rescheduleAgendamentoId) {
                            const [ano, mes, dia] = rescheduleDate.split('-');
                            return {
                              ...app,
                              data_consulta: `${dia}/${mes}/${ano}`,
                              horario_consulta: rescheduleTime,
                              status: 'pendente'
                            };
                          }
                          return app;
                        })
                      );
                    } catch (e: any) {
                      setRescheduleError(e?.message || "Falha ao reagendar consulta");
                    } finally {
                      setIsSubmittingReschedule(false);
                    }
                  }}
                >
                  {isSubmittingReschedule ? "Salvando..." : "Confirmar Reagendamento"}
                </button>
              </div>
            </div>
          </div>
        )}

        {isPetImageEditorOpen && petImageToEdit && (
          <ImageEditor
            imageSrc={petImageToEdit}
            title="Editar Foto do Pet"
            aspectRatio={1}
            onCancel={() => {
              setIsPetImageEditorOpen(false);
              if (petImageToEdit) {
                URL.revokeObjectURL(petImageToEdit);
              }
              setPetImageToEdit(null);
              setPhotoFile(null);
            }}
            onSave={(canvas) => {
              // Salva a prévia e fecha o editor
              canvas.toBlob((blob) => {
                if (blob) {
                  const previewUrl = URL.createObjectURL(blob);
                  setPhotoPreview(previewUrl);
                }
              }, "image/png", 0.95);
              setIsPetImageEditorOpen(false);
              if (petImageToEdit) {
                URL.revokeObjectURL(petImageToEdit);
              }
              setPetImageToEdit(null);
            }}
          />
        )}
      </div>
    </div>
  );
}
