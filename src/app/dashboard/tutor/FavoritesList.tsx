"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { FavoritesService } from "@/services/favorites/favorites";
import { Heart, MapPin, ExternalLink, Stethoscope, Star } from "lucide-react";
import styles from "./tutor.module.css"; // Reuse existing styles or inline new ones if needed

interface FavoriteItem {
  id: string;


  // veterinario relation
  veterinario?: {
    id: string;
    fotoUrl?: string;
    user?: {
      nome: string;
    };
    enderecos?: {
      cidade: string;
      estado: string;
    }[];
  };

  // clinica relation
  clinica?: {
    id: string;
    nomeClinica?: string;
    user?: {
      nome: string;
    };
    fotoPerfil?: string;
    cidade?: string;
    estado?: string;
  };
}

export function FavoritesList() {
  const [favorites, setFavorites] = useState<FavoriteItem[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    loadFavorites();
  }, []);

  const loadFavorites = async () => {
    try {
      setLoading(true);
      const list = await FavoritesService.list();
      setFavorites(list);
    } catch (error) {
      console.error("Failed to load favorites", error);
    } finally {
      setLoading(false);
    }
  };

  const removeFavorite = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Remover dos favoritos?")) return;
    try {
      await FavoritesService.remove(id);
      setFavorites(favorites.filter(f => f.id !== id));
    } catch (error) {
      console.error("Failed to remove favorite", error);
    }
  };

  if (loading) return <p className={styles.muted}>Carregando favoritos...</p>;
  if (favorites.length === 0) return <p className={styles.muted}>Você ainda não tem favoritos.</p>;

  return (
    <div className={styles.favoritesGrid}>
      {favorites.map(fav => {
        const item = fav.veterinario || fav.clinica || null;
        if (!item) return null;

        const isVet = !!fav.veterinario;

        let name = "Nome indisponível";
        let location = "Localização não informada";

        if (isVet && fav.veterinario) {
          name = fav.veterinario.user?.nome || "Veterinário";
          const addr = fav.veterinario.enderecos?.[0];
          if (addr && addr.cidade && addr.estado) {
            location = `${addr.cidade}, ${addr.estado}`;
          }
        } else if (fav.clinica) {
          name = fav.clinica.nomeClinica || fav.clinica.user?.nome || "Clínica";
          if (fav.clinica.cidade && fav.clinica.estado) {
            location = `${fav.clinica.cidade}, ${fav.clinica.estado}`;
          }
        }

        const image = isVet ? fav.veterinario!.fotoUrl : fav.clinica!.fotoPerfil;
        const link = isVet ? `/veterinario/${item.id}` : `/clinicas/${item.id}`;

        return (
          <div key={fav.id} className={styles.favoriteCard} onClick={() => router.push(link)}>
            <div className={styles.favoriteHeader}>
              <div className={styles.favoriteImageContainer}>
                {image ? (
                  <img src={image} alt={name} className={styles.favoriteImage} />
                ) : (
                  <div className={styles.favoriteBackupAvatar}>
                    {name.charAt(0)}
                  </div>
                )}
              </div>
              <div className={styles.favoriteContent}>
                <h4 className={styles.favoriteName} title={name}>{name}</h4>

                <span className={`${styles.favoriteTypeBadge} ${isVet ? styles.badgeVet : styles.badgeClinic}`}>
                  {isVet ? "Veterinário" : "Clínica"}
                </span>

                <div className={styles.favoriteLocation}>
                  <MapPin size={14} />
                  <span>{location}</span>
                </div>
              </div>
            </div>

            <button
              onClick={(e) => removeFavorite(fav.id, e)}
              className={styles.btnRemoveFavorite}
              title="Remover favorito"
            >
              <Heart size={16} fill="#ef4444" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
