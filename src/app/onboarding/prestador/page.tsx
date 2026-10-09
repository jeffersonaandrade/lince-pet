"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { PrestadoresService, type PerfilPrestador } from "@/services/prestadores/prestadores";
import { useAuth } from "@/contexts/AuthContext";
import { FormApresentacao, FormEndereco, FormServicos } from "@/components/Prestador/FormsPrestador";
import { Alerta } from "@/components/Prestador/ui";

const PASSOS = [
  { titulo: "Onde você atende", texto: "Endereço e se atende em domicílio, no seu espaço ou nos dois." },
  { titulo: "Serviços e preços", texto: "O que o tutor pode pedir e quanto custa." },
  { titulo: "Apresentação e horários", texto: "Conte sobre você e defina sua grade semanal." },
];

export default function OnboardingPrestador() {
  const router = useRouter();
  const { user, login } = useAuth();
  const [perfil, setPerfil] = useState<PerfilPrestador | null>(null);
  const [passo, setPasso] = useState(1);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    const p = await PrestadoresService.perfil();
    setPerfil(p);
    return p;
  }, []);

  useEffect(() => {
    carregar()
      .then((p) => setPasso(Math.min(Math.max(p.onboarding_step, 1), PASSOS.length)))
      .catch(() => setErro("Não foi possível carregar seu perfil. Entre novamente."));
  }, [carregar]);

  const avancar = async () => {
    await carregar();
    if (passo < PASSOS.length) return setPasso(passo + 1);
    if (user) login({ ...user, onboardingComplete: 1 });
    router.push("/dashboard/prestador");
  };

  const voltar = passo > 1 ? () => setPasso(passo - 1) : undefined;
  const atual = PASSOS[passo - 1];

  return (
    <main className="flex min-h-screen justify-center bg-slate-50 px-4 py-12">
      <div className="flex w-full max-w-3xl flex-col gap-6">
        <header className="flex flex-col gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-orange-600">
            {perfil?.tipo_servico.nome || "Profissional pet"} · Passo {passo} de {PASSOS.length}
          </span>
          <h1 className="text-2xl font-bold text-slate-900">{atual.titulo}</h1>
          <p className="text-sm text-slate-500">{atual.texto}</p>
          <div className="mt-2 flex gap-2" aria-hidden>
            {PASSOS.map((_, i) => (
              <span key={i} className={`h-1.5 flex-1 rounded-full ${i < passo ? "bg-orange-500" : "bg-slate-200"}`} />
            ))}
          </div>
        </header>

        <section className="rounded-3xl bg-white p-6 shadow-sm sm:p-8">
          {erro ? <Alerta>{erro}</Alerta> : null}
          {!perfil && !erro ? <p className="text-sm text-slate-500">Carregando...</p> : null}
          {perfil && passo === 1 ? <FormEndereco perfil={perfil} onSalvo={avancar} textoBotao="Continuar" /> : null}
          {perfil && passo === 2 ? (
            <FormServicos perfil={perfil} onSalvo={avancar} textoBotao="Continuar" onVoltar={voltar} />
          ) : null}
          {perfil && passo === 3 ? (
            <FormApresentacao perfil={perfil} onSalvo={avancar} textoBotao="Concluir perfil" onVoltar={voltar} />
          ) : null}
        </section>
      </div>
    </main>
  );
}
