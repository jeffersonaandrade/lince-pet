"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { FlaskConical, MapPin } from "lucide-react";
import UserImage from "@/components/ui/UserImage/UserImage";
import { ExamesService, formatarDuracao, formatarPreco, type OfertaExames } from "@/services/exames/exames";

const MAX_EXAMES_NO_CARTAO = 4;

/** Aba "Exames" do /explorar: clínicas com exames, filtradas pelo nome do exame (search) e cidade (location). */
export default function ListaExames() {
  const searchParams = useSearchParams();
  const busca = searchParams.get("search") || "";
  const localizacao = searchParams.get("location") || "";
  const [lista, setLista] = useState<OfertaExames[] | null>(null);
  const [erro, setErro] = useState(false);

  useEffect(() => {
    const cidade = localizacao.split(",")[0]?.trim() || undefined;
    setLista(null);
    setErro(false);
    ExamesService.buscar({ search: busca || undefined, cidade })
      .then(setLista)
      .catch(() => setErro(true));
  }, [busca, localizacao]);

  if (erro) return <p className="px-4 py-8 text-center text-red-600">Não foi possível carregar os exames. Tente novamente.</p>;
  if (lista === null) return <p className="px-4 py-8 text-center text-slate-500">Carregando exames...</p>;
  if (!lista.length) {
    return (
      <p className="px-4 py-8 text-center text-slate-500">
        Nenhuma clínica com {busca ? `o exame "${busca}"` : "exames"} {localizacao ? `em ${localizacao}` : "por aqui"} ainda.
      </p>
    );
  }

  const termo = busca.toLowerCase();
  return (
    <div className="mx-auto grid max-w-6xl gap-4 px-4 py-6 md:grid-cols-2">
      <p className="text-sm text-slate-500 md:col-span-2">
        {lista.length} clínica{lista.length > 1 ? "s" : ""} com exames · pagamento na clínica
      </p>
      {lista.map(({ clinica, exames, combos }) => {
        const destaque = termo ? [...exames].sort((a, b) => Number(b.nome.toLowerCase().includes(termo)) - Number(a.nome.toLowerCase().includes(termo))) : exames;
        return (
          <article key={clinica.id} aria-label={clinica.nome} className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <UserImage src={clinica.foto ?? undefined} alt={clinica.nome} size={48} />
              <div>
                <h3 className="font-bold text-slate-800">{clinica.nome}</h3>
                <p className="flex items-center gap-1 text-sm text-slate-500">
                  <MapPin size={14} /> {[clinica.cidade, clinica.estado].filter(Boolean).join(" - ")}
                </p>
              </div>
            </div>
            <ul className="flex flex-col gap-1 text-sm">
              {destaque.slice(0, MAX_EXAMES_NO_CARTAO).map((e) => (
                <li key={e.id} className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-1.5 text-slate-700">
                    <FlaskConical size={14} className="text-orange-500" /> {e.nome}
                    <span className="text-xs text-slate-400">({formatarDuracao(e.duracao_min)})</span>
                  </span>
                  <span className="font-semibold text-slate-800">{formatarPreco(e.preco)}</span>
                </li>
              ))}
              {exames.length > MAX_EXAMES_NO_CARTAO ? (
                <li className="text-xs text-slate-500">+ {exames.length - MAX_EXAMES_NO_CARTAO} exame(s)</li>
              ) : null}
              {combos.length ? <li className="text-xs font-medium text-orange-700">{combos.length} combo(s) com desconto</li> : null}
            </ul>
            <Link
              href={`/exames/${clinica.id}`}
              className="mt-auto rounded-lg bg-orange-500 px-4 py-2 text-center text-sm font-semibold text-white transition hover:bg-orange-600"
            >
              Agendar exame
            </Link>
          </article>
        );
      })}
    </div>
  );
}
