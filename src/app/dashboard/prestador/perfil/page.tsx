"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { PrestadoresService, type PerfilPrestador } from "@/services/prestadores/prestadores";
import { FormApresentacao, FormEndereco, FormServicos } from "@/components/Prestador/FormsPrestador";
import { PreferenciasNotificacao, ConexaoGoogleAgenda } from "@/components/PreferenciasNotificacao/PreferenciasNotificacao";
import { Alerta } from "@/components/Prestador/ui";

const SECOES = [
  { id: "endereco", titulo: "Onde você atende" },
  { id: "servicos", titulo: "Serviços e preços" },
  { id: "apresentacao", titulo: "Apresentação e horários" },
  { id: "avisos", titulo: "Avisos" },
] as const;

type Secao = (typeof SECOES)[number]["id"];

export default function PerfilPrestadorPage() {
  const router = useRouter();
  const { user, loading, checkAuth } = useAuth();
  const [perfil, setPerfil] = useState<PerfilPrestador | null>(null);
  const [secao, setSecao] = useState<Secao>("endereco");
  const [aviso, setAviso] = useState<{ texto: string; tipo: "sucesso" | "erro" } | null>(null);

  const mostrarAviso = useCallback((texto: string, tipo: "success" | "error" = "success") => {
    setAviso({ texto, tipo: tipo === "success" ? "sucesso" : "erro" });
    setTimeout(() => setAviso(null), 3500);
  }, []);

  const carregar = useCallback(async () => setPerfil(await PrestadoresService.perfil()), []);

  useEffect(() => {
    if (loading) return;
    if (!user) return router.push("/login");
    if (user.userType !== "prestador") return router.push("/");
    carregar().catch(() => mostrarAviso("Não foi possível carregar seu perfil.", "error"));
  }, [user, loading, router, carregar, mostrarAviso]);

  const salvo = async () => {
    await carregar();
    mostrarAviso("Alterações salvas.");
  };

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <span className="text-xs font-semibold uppercase tracking-wide text-orange-600">
              {perfil?.tipo_servico.nome || "Profissional pet"}
            </span>
            <h1 className="text-2xl font-bold text-slate-900">Meu perfil</h1>
          </div>
          <Link href="/dashboard/prestador" className="text-sm font-semibold text-orange-600 hover:underline">
            Voltar ao painel
          </Link>
        </header>

        <nav className="flex flex-wrap gap-2" role="tablist">
          {SECOES.map((s) => (
            <button
              key={s.id}
              role="tab"
              aria-selected={secao === s.id}
              onClick={() => setSecao(s.id)}
              className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                secao === s.id ? "bg-orange-500 text-white" : "bg-white text-slate-600 hover:bg-slate-100"
              }`}
            >
              {s.titulo}
            </button>
          ))}
        </nav>

        {aviso ? <Alerta tipo={aviso.tipo}>{aviso.texto}</Alerta> : null}

        <section className="rounded-3xl bg-white p-6 shadow-sm sm:p-8">
          {!perfil ? <p className="text-sm text-slate-500">Carregando...</p> : null}
          {perfil && secao === "endereco" ? <FormEndereco perfil={perfil} onSalvo={salvo} textoBotao="Salvar" /> : null}
          {perfil && secao === "servicos" ? <FormServicos perfil={perfil} onSalvo={salvo} textoBotao="Salvar" /> : null}
          {perfil && secao === "apresentacao" ? (
            <FormApresentacao perfil={perfil} onSalvo={salvo} textoBotao="Salvar" />
          ) : null}
          {secao === "avisos" ? (
            <PreferenciasNotificacao onAviso={mostrarAviso}>
              <ConexaoGoogleAgenda
                conectado={Boolean(user?.googleCalendarAuthorized)}
                onAlterado={checkAuth}
                onAviso={mostrarAviso}
              />
            </PreferenciasNotificacao>
          ) : null}
        </section>
      </div>
    </main>
  );
}
