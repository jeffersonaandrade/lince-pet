"use client";

import { useEffect, useState } from "react";
import { FavoritesService, type Favorito } from "@/services/favorites/favorites";
import { mensagemDeErro } from "@/lib/erros";

export function useFavoritos() {
  const [favoritos, setFavoritos] = useState<Favorito[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let ativo = true;
    FavoritesService.list()
      .then((lista) => {
        if (ativo) setFavoritos(lista);
      })
      .catch((error: unknown) => {
        if (ativo) setErro(mensagemDeErro(error, "Não foi possível carregar seus favoritos."));
      })
      .finally(() => {
        if (ativo) setCarregando(false);
      });
    return () => {
      ativo = false;
    };
  }, []);

  const remover = async (id: string) => {
    if (!confirm("Remover dos favoritos?")) return;
    try {
      await FavoritesService.remove(id);
      setFavoritos((lista) => lista.filter((f) => f.id !== id));
    } catch (error) {
      alert(mensagemDeErro(error, "Não foi possível remover o favorito."));
    }
  };

  return { favoritos, carregando, erro, remover };
}
