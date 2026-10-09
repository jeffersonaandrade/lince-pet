"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Check, SlidersHorizontal } from "lucide-react";
import { lerOrdenacao, type CriterioOrdenacao, type DirecaoOrdenacao } from "@/lib/ordenacao";
import styles from "./searchbar.module.css";

const OPCOES: { ordem: CriterioOrdenacao; direcao: DirecaoOrdenacao; rotulo: string }[] = [
  { ordem: "nome", direcao: "asc", rotulo: "Nome (A–Z)" },
  { ordem: "nome", direcao: "desc", rotulo: "Nome (Z–A)" },
  { ordem: "nota", direcao: "desc", rotulo: "Maior nota" },
  { ordem: "nota", direcao: "asc", rotulo: "Menor nota" },
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
    const padrao = proximaOrdem === "nota" && proximaDirecao === "desc";
    if (padrao) {
      params.delete("ordem");
      params.delete("direcao");
    } else {
      params.set("ordem", proximaOrdem);
      params.set("direcao", proximaDirecao);
    }
    const query = params.toString();
    router.replace(query ? `?${query}` : "/explorar", { scroll: false });
    setAberto(false);
  };

  const padraoAtivo = criterio === "nota" && direcao === "desc";
  const ativa = OPCOES.find((opcao) => opcao.ordem === criterio && opcao.direcao === direcao);

  return (
    <div className={styles.sortRoot} ref={raizRef}>
      <button
        type="button"
        className={`${styles.filterButton} ${padraoAtivo ? "" : styles.filterButtonActive}`}
        aria-label={ativa ? `Ordenar lista, ${ativa.rotulo}` : "Ordenar lista"}
        aria-expanded={aberto}
        aria-controls={painelId}
        onClick={() => setAberto((atual) => !atual)}
      >
        <SlidersHorizontal size={20} />
      </button>
      {aberto ? (
        <div id={painelId} className={styles.sortPanel} role="menu" aria-label="Ordenar lista">
          {OPCOES.map((opcao) => {
            const selecionada = criterio === opcao.ordem && direcao === opcao.direcao;
            return (
              <button
                key={opcao.rotulo}
                type="button"
                role="menuitemradio"
                aria-checked={selecionada}
                className={`${styles.sortOption} ${selecionada ? styles.sortOptionActive : ""}`}
                onClick={() => aplicar(opcao.ordem, opcao.direcao)}
              >
                <span>{opcao.rotulo}</span>
                {selecionada ? <Check size={16} aria-hidden="true" /> : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
