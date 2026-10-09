"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { SlidersHorizontal } from "lucide-react";
import { lerOrdenacao, type CriterioOrdenacao, type DirecaoOrdenacao } from "@/lib/ordenacao";
import styles from "./searchbar.module.css";

const CRITERIOS: { id: CriterioOrdenacao; rotulo: string }[] = [
  { id: "nome", rotulo: "Ordem alfabética" },
  { id: "nota", rotulo: "Nota" },
];

const DIRECOES: { id: DirecaoOrdenacao; rotulo: string }[] = [
  { id: "asc", rotulo: "Crescente" },
  { id: "desc", rotulo: "Decrescente" },
];

export default function OrdenacaoLista() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [aberto, setAberto] = useState(false);
  const raizRef = useRef<HTMLDivElement>(null);
  const painelId = useId();
  const { criterio, direcao } = lerOrdenacao(searchParams);

  useEffect(() => {
    if (!aberto) return;
    const fechar = (evento: MouseEvent) => {
      if (!raizRef.current?.contains(evento.target as Node)) setAberto(false);
    };
    const tecla = (evento: KeyboardEvent) => {
      if (evento.key === "Escape") setAberto(false);
    };
    document.addEventListener("mousedown", fechar);
    document.addEventListener("keydown", tecla);
    return () => {
      document.removeEventListener("mousedown", fechar);
      document.removeEventListener("keydown", tecla);
    };
  }, [aberto]);

  const aplicar = (proximaOrdem: CriterioOrdenacao, proximaDirecao: DirecaoOrdenacao) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("ordem", proximaOrdem);
    params.set("direcao", proximaDirecao);
    router.replace(`?${params.toString()}`, { scroll: false });
  };

  const limpar = () => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("ordem");
    params.delete("direcao");
    const query = params.toString();
    router.replace(query ? `?${query}` : "/explorar", { scroll: false });
    setAberto(false);
  };

  const dica =
    (criterio ?? "nome") === "nota"
      ? direcao === "asc"
        ? "Menor nota primeiro."
        : "Maior nota primeiro."
      : direcao === "asc"
        ? "De A a Z."
        : "De Z a A.";

  return (
    <div className={styles.sortRoot} ref={raizRef}>
      <button
        type="button"
        className={`${styles.filterButton} ${criterio ? styles.filterButtonActive : ""}`}
        aria-label="Ordenar lista"
        aria-expanded={aberto}
        aria-controls={painelId}
        onClick={() => setAberto((atual) => !atual)}
      >
        <SlidersHorizontal size={20} />
      </button>
      {aberto ? (
        <div id={painelId} className={styles.sortPanel} role="dialog" aria-label="Ordenação da lista">
          <p className={styles.sortLabel}>Ordenar por</p>
          <div className={styles.sortOptions} role="radiogroup" aria-label="Critério">
            {CRITERIOS.map((item) => (
              <button
                key={item.id}
                type="button"
                role="radio"
                aria-checked={criterio === item.id}
                className={`${styles.sortOption} ${criterio === item.id ? styles.sortOptionActive : ""}`}
                onClick={() =>
                  aplicar(item.id, criterio ? direcao : item.id === "nota" ? "desc" : "asc")
                }
              >
                {item.rotulo}
              </button>
            ))}
          </div>
          <p className={styles.sortLabel}>Ordem</p>
          <div className={styles.sortOptions} role="radiogroup" aria-label="Direção">
            {DIRECOES.map((item) => (
              <button
                key={item.id}
                type="button"
                role="radio"
                aria-checked={criterio !== null && direcao === item.id}
                className={`${styles.sortOption} ${criterio !== null && direcao === item.id ? styles.sortOptionActive : ""}`}
                onClick={() => aplicar(criterio ?? "nome", item.id)}
              >
                {item.rotulo}
              </button>
            ))}
          </div>
          <p className={styles.sortHint}>{dica}</p>
          {criterio ? (
            <button type="button" className={styles.sortClear} onClick={limpar}>
              Limpar ordenação
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
