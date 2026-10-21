"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { ClipboardList, Clock, Dog, History, Pencil, Send, Star, User as UserIcon } from "lucide-react";
import styles from "../tutor.module.css";
import { useAuth } from "@/contexts/AuthContext";
import ProntuarioPet from "@/components/Prontuario/ProntuarioPet";
import EncaminhamentosTutor from "@/components/Encaminhamento/EncaminhamentosTutor";
import { ImageEditor } from "@/components/ImageEditor/ImageEditor";
import ProfileImageUploader from "@/components/ProfileImageUploader/ProfileImageUploader";
import LottieLoading from "@/components/ui/LottieLoading/LottieLoading";
import { useAgendaTutor } from "@/hook/tutor/useAgendaTutor";
import { useReagendamento } from "@/hook/tutor/useReagendamento";
import { useCancelamentoConsulta } from "@/hook/tutor/useCancelamentoConsulta";
import { useAvaliacaoConsulta } from "@/hook/tutor/useAvaliacaoConsulta";
import { usePetsTutor } from "@/hook/tutor/usePetsTutor";
import { useFotoTutor } from "@/hook/tutor/useFotoTutor";
import { consultaConcluida } from "@/lib/agenda-tutor";
import { PORTES_PET } from "@/config/pets";
import { AppointmentItem } from "./AppointmentItem";
import { FavoritesList } from "./FavoritesList";
import { PetModal } from "./PetModal";
import { AvaliacaoModal } from "./AvaliacaoModal";
import { ReagendamentoModal } from "./ReagendamentoModal";
import { CancelamentoModal } from "./CancelamentoModal";

const tituloSecao = `${styles.sectionTitle} flex items-center gap-2`;
const rotuloPorte = (porte: string) => PORTES_PET.find((p) => p.value === porte)?.label ?? porte;

export function TutorDashboard() {
  const { user, loading, updateUser } = useAuth();
  const router = useRouter();
  const ehTutor = user?.userType === "tutor";

  const agenda = useAgendaTutor();
  const reagendamento = useReagendamento(agenda.aplicarReagendamento);
  const cancelamento = useCancelamentoConsulta(agenda.marcarCancelado);
  const avaliacao = useAvaliacaoConsulta(agenda.marcarAvaliado);
  const pets = usePetsTutor(ehTutor);
  const foto = useFotoTutor((fotoUrl) => updateUser({ fotoUrl }));
  const [prontuarioPet, setProntuarioPet] = useState<{ id: string; nome: string } | null>(null);

  const { carregar } = agenda;
  useEffect(() => {
    if (loading) return;
    if (!user) router.push("/login");
    else if (!ehTutor) router.push("/");
    else carregar();
  }, [loading, user, ehTutor, router, carregar]);

  if (loading) {
    return (
      <div className={`${styles.loadingContainer} flex min-h-screen items-center`}>
        <LottieLoading />
      </div>
    );
  }

  if (!user || !ehTutor) return null;

  return (
    <div className={styles.pageWrapper}>
      <div className={styles.coverWrapper}>
        <div className={styles.coverFallback} />
      </div>

      <div className={styles.contentWrapper}>
        <section className={styles.headerInfo}>
          <div className={styles.logoWrapper}>
            <ProfileImageUploader
              currentImageUrl={user.fotoUrl}
              userName={user.nome}
              isUploading={foto.enviando}
              onUpload={foto.enviar}
              className={styles.profileImageUploader}
              borderRadius="12px"
            />
          </div>

          <div className={styles.titleSection}>
            <div className={styles.titleRow}>
              <div>
                <h1 className="m-0 text-[1.8rem] text-[var(--text-color)]">Olá, {user.nome}!</h1>
                <p className="mt-1 text-slate-500">Aqui está o seu espaço de tutor</p>
              </div>
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
                <h2 className={tituloSecao}>
                  <Dog size={20} className={styles.metaInfoIcon} />
                  Meus Pets
                </h2>
                <button type="button" className={styles.primaryButton} onClick={pets.abrirNovo}>
                  + Adicionar Pet
                </button>
              </div>

              <div className={styles.petsList}>
                {pets.erroLista ? <p className={styles.muted} role="alert">{pets.erroLista}</p> : null}
                {!pets.erroLista && pets.pets.length === 0 ? (
                  <p className={styles.muted}>Nenhum pet cadastrado ainda.</p>
                ) : null}
                {pets.pets.map((p) => (
                  <div key={p.id} className={styles.petItem}>
                    {p.foto_url ? (
                      <Image src={p.foto_url} alt={p.nome} className={styles.uploaderPreview} width={100} height={100} />
                    ) : (
                      <div className={styles.petAvatar}>{p.nome.charAt(0).toUpperCase()}</div>
                    )}
                    <div className={styles.petInfo}>
                      <div className={styles.petName}>{p.nome}</div>
                      <div className={styles.petMeta}>
                        <span>{p.especie}</span>
                        {p.raca ? <span>• {p.raca}</span> : null}
                        {p.porte ? <span>• {rotuloPorte(p.porte)}</span> : null}
                        {typeof p.idade === "number" ? <span>• {p.idade} ano(s)</span> : null}
                      </div>
                    </div>
                    <button
                      type="button"
                      className={styles.actionButtonGhost}
                      onClick={() => setProntuarioPet({ id: p.id, nome: p.nome })}
                      title="Ver prontuário"
                      aria-label={`Ver prontuário de ${p.nome}`}
                    >
                      <ClipboardList size={18} />
                    </button>
                    <button
                      type="button"
                      className={styles.actionButtonGhost}
                      onClick={() => pets.abrirEdicao(p)}
                      title="Editar pet"
                      aria-label={`Editar ${p.nome}`}
                    >
                      <Pencil size={18} />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className={styles.card}>
              <h3 className={`${styles.cardTitle} flex items-center gap-2`}>
                <UserIcon size={20} className={styles.metaInfoIcon} />
                Informações do Tutor
              </h3>
              <div className={styles.infoList}>
                <div className={styles.infoItem}>
                  <span className={styles.infoLabel}>Nome</span>
                  <span className={styles.infoValue}>{user.nome}</span>
                </div>
                {user.email ? (
                  <div className={styles.infoItem}>
                    <span className={styles.infoLabel}>E-mail</span>
                    <span className={styles.infoValue}>{user.email}</span>
                  </div>
                ) : null}
                {user.cidade || user.estado ? (
                  <div className={styles.infoItem}>
                    <span className={styles.infoLabel}>Localidade</span>
                    <span className={styles.infoValue}>{[user.cidade, user.estado].filter(Boolean).join(" - ")}</span>
                  </div>
                ) : null}
                {user.createdAt ? (
                  <div className={styles.infoItem}>
                    <span className={styles.infoLabel}>Desde</span>
                    <span className={styles.infoValue}>{new Date(user.createdAt).toLocaleDateString("pt-BR")}</span>
                  </div>
                ) : null}
              </div>
            </div>

            <div className={styles.card}>
              <div className={styles.cardHeader}>
                <h2 className={tituloSecao}>
                  <Clock size={20} className={styles.metaInfoIcon} />
                  Próximas Consultas
                </h2>
              </div>
              {agenda.carregando ? <LottieLoading width={150} height={150} /> : null}
              {agenda.erro ? <p className={styles.muted} role="alert">{agenda.erro}</p> : null}
              {!agenda.carregando && !agenda.erro && agenda.proximas.length === 0 ? (
                <p className={styles.muted}>Nenhuma consulta agendada.</p>
              ) : null}
              <div className={styles.appointmentsList}>
                {agenda.proximas.map((a) => (
                  <AppointmentItem
                    key={a.id}
                    agendamento={a}
                    onCancel={cancelamento.abrir}
                    onChanged={carregar}
                    onReschedule={reagendamento.abrir}
                  />
                ))}
              </div>
            </div>

            <div className={styles.card}>
              <div className={styles.cardHeader}>
                <h2 className={tituloSecao}>
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
                <h2 className={tituloSecao}>
                  <Star size={20} className={styles.metaInfoIcon} />
                  Meus Favoritos
                </h2>
              </div>
              <FavoritesList />
            </div>

            <div className={styles.card}>
              <div className={styles.cardHeader}>
                <h2 className={tituloSecao}>
                  <History size={20} className={styles.metaInfoIcon} />
                  Histórico de Consultas
                </h2>
              </div>
              {agenda.carregando ? <LottieLoading width={150} height={150} /> : null}
              {!agenda.carregando && !agenda.erro && agenda.historicoPorAno.length === 0 ? (
                <p className={styles.muted}>Nenhuma consulta no histórico.</p>
              ) : null}
              {agenda.historicoPorAno.map(({ ano, itens }) => (
                <div key={ano} className="mb-6">
                  <h4 className={styles.yearTitle}>{ano}</h4>
                  <div className={styles.appointmentsList}>
                    {itens.map((a) => (
                      <AppointmentItem
                        key={a.id}
                        agendamento={a}
                        onCancel={cancelamento.abrir}
                        onChanged={carregar}
                        onReschedule={reagendamento.abrir}
                        onRate={avaliacao.abrir}
                        podeAvaliar={consultaConcluida(a.status) && !a.avaliado}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {prontuarioPet ? (
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
        ) : null}

        {pets.modalAberto ? <PetModal pets={pets} /> : null}
        <AvaliacaoModal avaliacao={avaliacao} />
        <ReagendamentoModal reagendamento={reagendamento} />
        <CancelamentoModal cancelamento={cancelamento} />

        {pets.imagemParaEditar ? (
          <ImageEditor
            imageSrc={pets.imagemParaEditar}
            title="Editar Foto do Pet"
            aspectRatio={1}
            onCancel={pets.cancelarRecorte}
            onSave={pets.salvarRecorte}
          />
        ) : null}
      </div>
    </div>
  );
}
