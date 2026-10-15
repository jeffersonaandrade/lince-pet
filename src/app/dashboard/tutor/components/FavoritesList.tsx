"use client";

import Image from "next/image";
import Link from "next/link";
import { Heart, MapPin } from "lucide-react";
import styles from "../tutor.module.css";
import { useFavoritos } from "@/hook/tutor/useFavoritos";
import type { Favorito } from "@/services/favorites/favorites";

function resumoDoFavorito(fav: Favorito) {
  const local = (cidade?: string | null, estado?: string | null) =>
    cidade && estado ? `${cidade}, ${estado}` : "Localização não informada";

  if (fav.veterinario) {
    const endereco = fav.veterinario.enderecos?.[0];
    return {
      veterinario: true,
      nome: fav.veterinario.user?.nome || "Veterinário",
      local: local(endereco?.cidade, endereco?.estado),
      imagem: fav.veterinario.fotoUrl,
      link: `/veterinario/${fav.veterinario.id}`,
    };
  }
  if (fav.clinica) {
    return {
      veterinario: false,
      nome: fav.clinica.nomeClinica || fav.clinica.user?.nome || "Clínica",
      local: local(fav.clinica.cidade, fav.clinica.estado),
      imagem: fav.clinica.fotoPerfil,
      link: `/clinicas/${fav.clinica.id}`,
    };
  }
  return null;
}

export function FavoritesList() {
  const { favoritos, carregando, erro, remover } = useFavoritos();

  if (carregando) return <p className={styles.muted}>Carregando favoritos...</p>;
  if (erro) return <p className={styles.muted} role="alert">{erro}</p>;
  if (favoritos.length === 0) return <p className={styles.muted}>Você ainda não tem favoritos.</p>;

  return (
    <div className={styles.favoritesGrid}>
      {favoritos.map((fav) => {
        const item = resumoDoFavorito(fav);
        if (!item) return null;
        return (
          <div key={fav.id} className={styles.favoriteCard}>
            <Link href={item.link} className={`${styles.favoriteHeader} text-inherit no-underline`}>
              <div className={styles.favoriteImageContainer}>
                {item.imagem ? (
                  <Image src={item.imagem} alt={item.nome} width={64} height={64} className={styles.favoriteImage} />
                ) : (
                  <div className={styles.favoriteBackupAvatar}>{item.nome.charAt(0)}</div>
                )}
              </div>
              <div className={styles.favoriteContent}>
                <h4 className={styles.favoriteName} title={item.nome}>{item.nome}</h4>
                <span className={`${styles.favoriteTypeBadge} ${item.veterinario ? styles.badgeVet : styles.badgeClinic}`}>
                  {item.veterinario ? "Veterinário" : "Clínica"}
                </span>
                <div className={styles.favoriteLocation}>
                  <MapPin size={14} />
                  <span>{item.local}</span>
                </div>
              </div>
            </Link>
            <button
              type="button"
              onClick={() => remover(fav.id)}
              className={styles.btnRemoveFavorite}
              title="Remover favorito"
              aria-label={`Remover ${item.nome} dos favoritos`}
            >
              <Heart size={16} fill="#ef4444" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
