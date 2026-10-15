"use client";

import { useState, type ReactNode } from "react";
import Image from "next/image";
import { MapPin, Stethoscope } from "lucide-react";
import styles from "../tutor.module.css";
import type { useAvaliacaoConsulta } from "@/hook/tutor/useAvaliacaoConsulta";

type Avaliacao = ReturnType<typeof useAvaliacaoConsulta>;
type Nota = Avaliacao["profissional"];

function Avatar({ src, nome, inicial, className }: { src?: string | null; nome: string; inicial: string; className: string }) {
  if (src) return <Image src={src} alt={nome} width={56} height={56} className={className} />;
  return <div className={className}>{inicial.toUpperCase()}</div>;
}

function SecaoNota({
  cabecalho,
  nota,
  onChange,
  placeholder,
}: {
  cabecalho: ReactNode;
  nota: Nota;
  onChange: (nota: Nota) => void;
  placeholder: string;
}) {
  const [hover, setHover] = useState(0);
  return (
    <div className={styles.ratingSection}>
      {cabecalho}
      <div className={styles.ratingContent}>
        <div className={styles.ratingHeader}>
          <div className={styles.ratingStars}>
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                className={n <= (hover || nota.estrelas) ? styles.starSelected : styles.star}
                onClick={() => onChange({ ...nota, estrelas: n })}
                onMouseEnter={() => setHover(n)}
                onMouseLeave={() => setHover(0)}
                aria-label={`${n} estrela${n > 1 ? "s" : ""}`}
                aria-pressed={n === nota.estrelas}
              >
                ★
              </button>
            ))}
          </div>
          <div className={styles.ratingHint}>
            {nota.estrelas > 0 ? `${nota.estrelas} de 5 estrelas` : "Selecione as estrelas"}
          </div>
        </div>
        <textarea
          className={styles.textarea}
          placeholder={placeholder}
          value={nota.comentario}
          maxLength={1000}
          onChange={(e) => onChange({ ...nota, comentario: e.target.value })}
        />
      </div>
    </div>
  );
}

export function AvaliacaoModal({ avaliacao }: { avaliacao: Avaliacao }) {
  const { agendamento, avaliaClinica, profissional, clinica, erro, enviando } = avaliacao;
  if (!agendamento) return null;

  const pessoa = agendamento.prestador ?? agendamento.veterinario;
  const nomePessoa = agendamento.prestador
    ? `${agendamento.prestador.nome} ${agendamento.prestador.sobrenome ?? ""}`.trim()
    : `Dr(a). ${agendamento.veterinario?.nome ?? ""} ${agendamento.veterinario?.sobrenome ?? ""}`.trim();
  const nomeLocal = agendamento.local_nome || "A Clínica";

  return (
    <div className={styles.modalOverlay} role="dialog" aria-modal="true" aria-labelledby="avaliacao-titulo">
      <div className={styles.modalCard}>
        <div className={styles.modalHeader}>
          <h4 id="avaliacao-titulo" className={styles.modalTitle}>Avaliar atendimento</h4>
          <button type="button" className={styles.modalClose} aria-label="Fechar" onClick={avaliacao.fechar}>
            ✕
          </button>
        </div>
        <div className={`${styles.modalBody} px-5 py-2`}>
          <SecaoNota
            nota={profissional}
            onChange={avaliacao.setProfissional}
            placeholder="Como foi a experiência com o profissional? (opcional)"
            cabecalho={
              <div className={styles.ratingEntityHeader}>
                <Avatar
                  src={pessoa?.fotoUrl}
                  nome={nomePessoa}
                  inicial={pessoa?.nome?.charAt(0) || "P"}
                  className={styles.ratingEntityAvatar}
                />
                <div className={styles.ratingEntityInfo}>
                  <h5 className={styles.ratingEntityName}>{nomePessoa}</h5>
                  <div className={styles.ratingEntitySubtitle}>
                    <Stethoscope size={14} /> {agendamento.prestador?.tipo_servico || "Veterinário(a)"}
                  </div>
                </div>
              </div>
            }
          />

          {avaliaClinica ? (
            <SecaoNota
              nota={clinica}
              onChange={avaliacao.setClinica}
              placeholder="Conte o que achou da estrutura e do serviço do local (opcional)"
              cabecalho={
                <div className={styles.ratingEntityHeader}>
                  <Avatar
                    src={agendamento.clinica_foto}
                    nome={nomeLocal}
                    inicial={nomeLocal.charAt(0)}
                    className={`${styles.ratingEntityAvatar} ${styles.ratingEntityClinicAvatar}`}
                  />
                  <div className={styles.ratingEntityInfo}>
                    <h5 className={styles.ratingEntityName}>{nomeLocal}</h5>
                    <div className={styles.ratingEntitySubtitle}>
                      <MapPin size={14} /> Espaço e Estrutura
                    </div>
                  </div>
                </div>
              }
            />
          ) : null}

          {erro ? <div className={styles.errorRow} role="alert">{erro}</div> : null}
        </div>
        <div className={styles.modalFooter}>
          <button type="button" className={styles.secondaryButton} onClick={avaliacao.fechar}>
            Cancelar
          </button>
          <button
            type="button"
            className={styles.primaryButton}
            disabled={enviando || profissional.estrelas < 1}
            onClick={avaliacao.enviar}
          >
            {enviando ? "Enviando..." : "Enviar avaliação"}
          </button>
        </div>
      </div>
    </div>
  );
}
