"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Star } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import {
  PrestadoresService,
  type Bloqueio,
  type Pedido,
  type PerfilPrestador,
  type PrestadorPublico,
} from "@/services/prestadores/prestadores";
import { PainelPedidos } from "@/components/Prestador/PainelPedidos";
import { PainelBloqueios } from "@/components/Prestador/PainelBloqueios";
import { CardPlano } from "@/components/Prestador/CardPlano";
import PainelRecebidos from "@/components/Encaminhamento/PainelRecebidos";
import { Alerta, botaoSecundario } from "@/components/Prestador/ui";

export default function DashboardPrestador() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [perfil, setPerfil] = useState<PerfilPrestador | null>(null);
  const [publico, setPublico] = useState<PrestadorPublico | null>(null);
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [bloqueios, setBloqueios] = useState<Bloqueio[]>([]);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (loading) return;
    if (!user) return router.push("/login");
    if (user.userType !== "prestador") return router.push("/");

    (async () => {
      try {
        const [p, lista, bloq] = await Promise.all([
          PrestadoresService.perfil(),
          PrestadoresService.pedidosRecebidos(),
          PrestadoresService.bloqueios(),
        ]);
        if (!p.onboarding_complete) return router.push("/onboarding/prestador");
        setPerfil(p);
        setPedidos(lista);
        setBloqueios(bloq);
        PrestadoresService.obter(p.id).then(setPublico).catch(() => null);
      } catch {
        setErro("Não foi possível carregar seu painel. Tente novamente.");
      }
    })();
  }, [user, loading, router]);

  const atualizarPedido = (novo: Pedido) => setPedidos((atual) => atual.map((p) => (p.id === novo.id ? novo : p)));

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-col gap-1">
            <span className="text-xs font-semibold uppercase tracking-wide text-orange-600">
              {perfil?.tipo_servico.nome || "Profissional pet"}
            </span>
            <h1 className="text-2xl font-bold text-slate-900">Olá, {user?.nome || "profissional"}</h1>
            {publico?.nota_media ? (
              <span className="flex items-center gap-1 text-sm text-slate-600">
                <Star size={14} className="fill-amber-400 text-amber-400" />
                {publico.nota_media.toFixed(1)} · {publico.total_avaliacoes} avaliação(ões)
              </span>
            ) : (
              <span className="text-sm text-slate-500">Ainda sem avaliações.</span>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {perfil ? (
              <Link href={`/profissionais/${perfil.id}`} className={botaoSecundario}>
                Ver perfil público
              </Link>
            ) : null}
            <Link href="/dashboard/prestador/perfil" className={botaoSecundario}>
              Editar perfil
            </Link>
          </div>
        </header>

        {erro ? <Alerta>{erro}</Alerta> : null}
        {!perfil && !erro ? <p className="text-sm text-slate-500">Carregando...</p> : null}

        {perfil ? (
          <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
            <div className="flex flex-col gap-6">
              <PainelPedidos pedidos={pedidos} onAtualizado={atualizarPedido} />
              <PainelRecebidos />
            </div>
            <div className="flex flex-col gap-6">
              <CardPlano />
              <PainelBloqueios bloqueios={bloqueios} onAlterado={setBloqueios} />
            </div>
          </div>
        ) : null}
      </div>
    </main>
  );
}
