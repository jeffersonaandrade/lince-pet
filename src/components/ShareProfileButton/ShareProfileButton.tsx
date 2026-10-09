"use client";

import { useState } from "react";
import { Share2, Check } from "lucide-react";
import styles from "./ShareProfileButton.module.css";

interface ShareProfileButtonProps {
  veterinarioId?: number | string;
  clinicaId?: number | string;
}

export default function ShareProfileButton({
  veterinarioId,
  clinicaId,
}: ShareProfileButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleCopyLink = async () => {
    try {
      // Determina a URL base do aplicativo
      const baseUrl = window.location.origin;
      const profileLink = veterinarioId
        ? `${baseUrl}/veterinario/${veterinarioId}`
        : `${baseUrl}/clinicas/${clinicaId}`;

      // Copia para clipboard
      await navigator.clipboard.writeText(profileLink);

      // Feedback visual
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error("Erro ao copiar link:", error);
      // Fallback para método antigo se a API moderna falhar
      try {
        const el = document.createElement("textarea");
        const profileLinkFallback = veterinarioId
          ? `${window.location.origin}/veterinario/${veterinarioId}`
          : `${window.location.origin}/clinicas/${clinicaId}`;
        el.value = profileLinkFallback;
        document.body.appendChild(el);
        el.select();
        document.execCommand("copy");
        document.body.removeChild(el);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch (err) {
        console.error("Erro ao copiar com fallback:", err);
        alert("Não foi possível copiar o link. Tente novamente.");
      }
    }
  };

  return (
    <button
      className={`${styles.shareButton} ${copied ? styles.copied : ""}`}
      onClick={handleCopyLink}
      title={
        copied
          ? "Link copiado para a área de transferência!"
          : "Copiar link do seu perfil"
      }
      aria-label={
        copied
          ? "Link copiado para a área de transferência"
          : "Copiar link do perfil"
      }
    >
      {copied ? (
        <>
          <Check size={18} />
          <span>Copiado!</span>
        </>
      ) : (
        <>
          <Share2 size={18} />
          <span>Compartilhar Perfil</span>
        </>
      )}
    </button>
  );
}
