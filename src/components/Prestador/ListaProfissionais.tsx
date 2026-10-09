"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { MapPin, Star } from "lucide-react";
import UserImage from "@/components/ui/UserImage/UserImage";
import { PrestadoresService, type PrestadorPublico, type TipoServico } from "@/services/prestadores/prestadores";
import { formatarPreco } from "./ui";
import { lerOrdenacao, ordenarLista } from "@/lib/ordenacao";

/** Filtros do /explorar (search e location "Cidade, UF") convertidos para a busca de prestadores. */
function filtrosDaUrl(params: URLSearchParams) {
  const location = params.get("location") || "";
  const [cidade, estado] = location.includes(",") ? location.split(",").map((s) => s.trim()) : [location, ""];
  return {
    tipo: params.get("tipo") || undefined,
    search: params.get("search") || undefined,
    cidade: cidade || undefined,
    estado: estado || undefined,
  };
}

/** Aba "Profissionais pet" do /explorar: filtro por tipo de serviço e lista de prestadores. */
export default function ListaProfissionais() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tipoAtual = searchParams.get("tipo") || "";
  const busca = searchParams.get("search") || "";
  const localizacao = searchParams.get("location") || "";
  const { criterio, direcao } = lerOrdenacao(searchParams);
  const [tipos, setTipos] = useState<TipoServico[]>([]);
  const [lista, setLista] = useState<PrestadorPublico[] | null>(null);
  const [erro, setErro] = useState(false);

  useEffect(() => {
    PrestadoresService.tiposServico().then(setTipos).catch(() => setTipos([]));
  }, []);

  useEffect(() => {
    const params = new URLSearchParams();
    if (tipoAtual) params.set("tipo", tipoAtual);
    if (busca) params.set("search", busca);
    if (localizacao) params.set("location", localizacao);
    setLista(null);
    setErro(false);
    PrestadoresService.buscar(filtrosDaUrl(params))
      .then(setLista)
      .catch(() => setErro(true));
  }, [tipoAtual, busca, localizacao]);

  const escolherTipo = (slug: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", "profissionais");
    if (slug) params.set("tipo", slug);
    else params.delete("tipo");
    router.replace(`?${params.toString()}`, { scroll: false });
  };

  const chip = (ativo: boolean) =>
    `rounded-full border px-4 py-2 text-sm font-semibold transition ${
      ativo ? "border-orange-500 bg-orange-500 text-white" : "border-slate-200 bg-white text-slate-600 hover:border-orange-300"
    }`;

  const visiveis =
    lista === null
      ? []
      : ordenarLista(lista, criterio, direcao, (p) => ({
          nome: p.nome,
          nota: p.nota_media ?? 0,
        }));

  return (
    <section className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 pb-16">
      <div className="flex flex-wrap gap-2" role="group" aria-label="Tipo de serviço">
        <button type="button" className={chip(!tipoAtual)} onClick={() => escolherTipo("")}>
          Todos
        </button>
        {tipos.map((t) => (
          <button key={t.slug} type="button" className={chip(tipoAtual === t.slug)} onClick={() => escolherTipo(t.slug)}>
            {t.nome}
          </button>
        ))}
      </div>

      {erro ? (
        <p className="rounded-xl bg-red-50 p-4 text-sm text-red-700">Erro ao buscar profissionais. Tente novamente.</p>
      ) : lista === null ? (
        <p className="text-sm text-slate-500">Buscando profissionais...</p>
      ) : (
        <>
          <p className="text-sm font-semibold text-slate-600">
            {visiveis.length} profissional{visiveis.length !== 1 ? "is" : ""} encontrado{visiveis.length !== 1 ? "s" : ""}
          </p>
          {visiveis.length === 0 ? (
            <div className="rounded-2xl bg-white p-8 text-center shadow-sm">
              <h3 className="text-lg font-bold text-slate-800">Nenhum profissional encontrado</h3>
              <p className="mt-1 text-sm text-slate-500">Tente outro tipo de serviço ou outra cidade.</p>
            </div>
          ) : (
            <ul className="flex flex-col gap-4">
              {visiveis.map((p) => (
                <li key={p.id}>
                  <Link
                    href={`/profissionais/${p.id}`}
                    className="flex flex-col gap-4 rounded-2xl bg-white p-5 shadow-sm transition hover:shadow-md sm:flex-row"
                  >
                    <UserImage src={p.foto_url || undefined} alt={p.nome} size={96} />
                    <div className="flex flex-1 flex-col gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-lg font-bold text-slate-900">{p.nome}</h3>
                        <span className="rounded-full bg-orange-50 px-3 py-1 text-xs font-semibold text-orange-700">
                          {p.tipo_servico.nome}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-4 text-sm text-slate-500">
                        <span className="inline-flex items-center gap-1">
                          <Star size={14} className="fill-amber-400 text-amber-400" />
                          {p.nota_media !== null ? p.nota_media.toFixed(1) : "Novo"} ({p.total_avaliacoes})
                        </span>
                        {p.cidade ? (
                          <span className="inline-flex items-center gap-1">
                            <MapPin size={14} />
                            {[p.bairro, p.cidade, p.estado].filter(Boolean).join(", ")}
                          </span>
                        ) : null}
                      </div>
                      {p.bio ? <p className="line-clamp-2 text-sm text-slate-600">{p.bio}</p> : null}
                      <div className="flex flex-wrap gap-2 text-xs text-slate-500">
                        {p.atende_domicilio ? <span className="rounded-full bg-slate-100 px-3 py-1">Atende em domicílio</span> : null}
                        {p.atende_local_proprio ? <span className="rounded-full bg-slate-100 px-3 py-1">Espaço próprio</span> : null}
                      </div>
                    </div>
                    <div className="flex flex-col items-start justify-center sm:items-end">
                      <span className="text-xs text-slate-500">a partir de</span>
                      <span className="text-xl font-bold text-slate-900">{formatarPreco(p.preco_a_partir)}</span>
                      {p.tipo_servico.modalidade === "periodo" ? (
                        <span className="text-xs text-slate-500">por diária</span>
                      ) : null}
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  );
}
