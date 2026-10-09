"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Home, MapPin, Star, Store } from "lucide-react";
import UserImage from "@/components/ui/UserImage/UserImage";
import PedidoServicoForm from "@/components/Prestador/PedidoServicoForm";
import { FaixaEncaminhamento, useEncaminhamentoDaUrl } from "@/components/Encaminhamento/FaixaEncaminhamento";
import { DIAS_SEMANA, formatarDuracao, formatarPreco } from "@/components/Prestador/ui";
import { PrestadoresService, type PrestadorPublico } from "@/services/prestadores/prestadores";

/** Perfil público do profissional pet: serviços, horários e o pedido. Sem CRMV nem consulta. */
export default function PerfilProfissionalPage() {
  const { id } = useParams<{ id: string }>();
  const [prestador, setPrestador] = useState<PrestadorPublico | null>(null);
  const [erro, setErro] = useState(false);
  const { encaminhamentoId, petId: petEncaminhadoId, encaminhamento } = useEncaminhamentoDaUrl();

  useEffect(() => {
    PrestadoresService.obter(id)
      .then(setPrestador)
      .catch(() => setErro(true));
  }, [id]);

  if (erro) {
    return (
      <main className="flex min-h-[60vh] items-center justify-center px-4">
        <p className="text-slate-600">Profissional não encontrado.</p>
      </main>
    );
  }
  if (!prestador) {
    return (
      <main className="flex min-h-[60vh] items-center justify-center px-4">
        <p className="text-sm text-slate-500">Carregando...</p>
      </main>
    );
  }

  const p = prestador;
  return (
    <main className="bg-slate-50 px-4 py-10">
      <div className="mx-auto grid w-full max-w-6xl grid-cols-1 gap-6 lg:grid-cols-[1fr_400px]">
        <div className="flex flex-col gap-6">
          <section className="flex flex-col gap-5 rounded-3xl bg-white p-6 shadow-sm sm:flex-row">
            <UserImage src={p.foto_url || undefined} alt={p.nome} size={128} />
            <div className="flex flex-1 flex-col gap-2">
              <span className="self-start rounded-full bg-orange-50 px-3 py-1 text-xs font-semibold text-orange-700">
                {p.tipo_servico.nome}
              </span>
              <h1 className="text-2xl font-bold text-slate-900">{p.nome}</h1>
              <div className="flex flex-wrap items-center gap-4 text-sm text-slate-500">
                <span className="inline-flex items-center gap-1">
                  <Star size={16} className="fill-amber-400 text-amber-400" />
                  {p.nota_media !== null ? p.nota_media.toFixed(1) : "Novo"} ({p.total_avaliacoes} avaliações)
                </span>
                {p.cidade ? (
                  <span className="inline-flex items-center gap-1">
                    <MapPin size={16} />
                    {[p.bairro, p.cidade, p.estado].filter(Boolean).join(", ")}
                  </span>
                ) : null}
              </div>
              <div className="flex flex-wrap gap-2 text-xs text-slate-600">
                {p.atende_domicilio ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1">
                    <Home size={14} /> Em domicílio{p.raio_km ? ` (até ${p.raio_km} km)` : ""}
                  </span>
                ) : null}
                {p.atende_local_proprio ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1">
                    <Store size={14} /> Espaço próprio
                  </span>
                ) : null}
              </div>
            </div>
          </section>

          {p.bio ? (
            <section className="rounded-3xl bg-white p-6 shadow-sm">
              <h2 className="mb-2 text-lg font-bold text-slate-800">Sobre</h2>
              <p className="whitespace-pre-line text-sm leading-relaxed text-slate-600">{p.bio}</p>
            </section>
          ) : null}

          <section className="rounded-3xl bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-lg font-bold text-slate-800">Serviços</h2>
            <ul className="divide-y divide-slate-100">
              {p.servicos.map((s) => (
                <li key={s.id} className="flex items-start justify-between gap-4 py-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-800">{s.nome}</p>
                    {s.descricao ? <p className="text-xs text-slate-500">{s.descricao}</p> : null}
                    <p className="text-xs text-slate-400">{formatarDuracao(s.duracao_min)}</p>
                  </div>
                  <span className="text-sm font-bold text-slate-900">{formatarPreco(s.preco)}</span>
                </li>
              ))}
            </ul>
          </section>

          <section className="rounded-3xl bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-lg font-bold text-slate-800">Horários de atendimento</h2>
            <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {DIAS_SEMANA.map((nome, i) => {
                const faixa = p.horarios[String(i)];
                return (
                  <li key={nome} className="flex justify-between rounded-xl bg-slate-50 px-4 py-2 text-sm">
                    <span className="text-slate-600">{nome}</span>
                    <span className={faixa ? "font-semibold text-slate-800" : "text-slate-400"}>
                      {faixa ? `${faixa[0]} às ${faixa[1]}` : "Não atende"}
                    </span>
                  </li>
                );
              })}
            </ul>
          </section>
        </div>

        <aside className="h-fit rounded-3xl bg-white p-6 shadow-sm lg:sticky lg:top-24">
          <h2 className="mb-4 text-lg font-bold text-slate-800">Pedir serviço</h2>
          <div className="mb-4 empty:hidden">
            <FaixaEncaminhamento encaminhamento={encaminhamento} />
          </div>
          <PedidoServicoForm prestador={p} encaminhamentoId={encaminhamentoId} petIdInicial={petEncaminhadoId} />
        </aside>
      </div>
    </main>
  );
}
