"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FlaskConical } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { urlDeLogin } from "@/lib/destino-login";
import { mensagemDeErro } from "@/lib/erros";
import { ExamesClinicaService, type PainelExames } from "@/services/exames/exames";
import { FormResponsavelTecnico } from "@/components/Exames/FormResponsavelTecnico";
import { CatalogoExames } from "@/components/Exames/CatalogoExames";
import { CombosExames } from "@/components/Exames/CombosExames";
import { AgendaExames } from "@/components/Exames/AgendaExames";
import { botaoPrimario, Mensagem, Secao } from "@/components/Exames/ui";

function StatusModulo({ painel, onAlternar }: { painel: PainelExames; onAlternar: (ativo: boolean) => Promise<void> }) {
  const [salvando, setSalvando] = useState(false);
  const pendencias = [
    !painel.exames_ativo && "ative a agenda de exames",
    painel.rt.rt_status !== "aprovado" && "aguarde a aprovação do responsável técnico",
    !painel.exames.some((e) => e.ativo) && "cadastre pelo menos um exame",
  ].filter(Boolean);
  const { usados, limite } = painel.uso_mes;

  return (
    <Secao titulo="Agenda de exames" rotulo="Status do módulo de exames">
      <label className="flex items-center gap-3 text-sm font-medium text-slate-700">
        <input
          type="checkbox"
          className="h-5 w-5 accent-orange-500"
          checked={painel.exames_ativo}
          disabled={salvando}
          onChange={async (e) => {
            setSalvando(true);
            try {
              await onAlternar(e.target.checked);
            } finally {
              setSalvando(false);
            }
          }}
        />
        Receber agendamentos de exames
      </label>
      <p className={`mt-3 text-sm ${painel.visivel && pendencias.length === 0 ? "text-emerald-700" : "text-amber-700"}`}>
        {painel.visivel && pendencias.length === 0
          ? "Seus exames aparecem na busca e no perfil da clínica."
          : `Para os exames aparecerem aos tutores: ${pendencias.join("; ")}.`}
      </p>
      <p className="mt-1 text-sm text-slate-500">
        Exames agendados este mês: {usados}
        {limite != null ? ` de ${limite}` : " (ilimitado)"}
      </p>
    </Secao>
  );
}

export default function ExamesClinicaPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [painel, setPainel] = useState<PainelExames | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    try {
      setPainel(await ExamesClinicaService.painel());
      setErro(null);
    } catch (error) {
      setErro(mensagemDeErro(error, "Não foi possível carregar os exames."));
    }
  }, []);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.push(urlDeLogin());
      return;
    }
    if (user.userType !== "clinica") {
      router.push("/");
      return;
    }
    void carregar();
  }, [user, loading, router, carregar]);

  if (loading || !user) return null;

  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-8">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <FlaskConical className="text-orange-500" size={28} />
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Exames</h1>
            <p className="text-sm text-slate-500">Catálogo, combos, responsável técnico e agenda de exames da clínica.</p>
          </div>
        </div>
        <Link href="/dashboard/clinica" className="text-sm font-medium text-orange-600 hover:underline">
          Voltar ao painel
        </Link>
      </header>

      <Mensagem texto={erro} />
      {painel === null ? <p className="text-sm text-slate-500">Carregando...</p> : null}

      {painel && !painel.plano_com_exames ? (
        <Secao titulo="Ofereça exames na Lince Pet" rotulo="Assine um plano">
          <p className="text-sm text-slate-600">
            A agenda de exames faz parte dos planos de clínica. Assine um plano para cadastrar exames e combos, receber
            agendamentos dos tutores e enviar laudos pelo prontuário.
          </p>
          <Link href="/dashboard/clinica/alterar-plano" className={`${botaoPrimario} mt-4 inline-block`}>
            Ver planos
          </Link>
        </Secao>
      ) : null}

      {painel?.plano_com_exames ? (
        <>
          <StatusModulo
            painel={painel}
            onAlternar={async (ativo) => {
              try {
                setPainel(await ExamesClinicaService.alternarModulo(ativo));
              } catch (error) {
                setErro(mensagemDeErro(error, "Não foi possível alterar a agenda de exames."));
              }
            }}
          />
          <FormResponsavelTecnico rt={painel.rt} onSalvo={(rt) => setPainel((p) => (p ? { ...p, rt } : p))} />
          <CatalogoExames exames={painel.exames} onMudou={carregar} />
          <CombosExames exames={painel.exames} combos={painel.combos} onMudou={carregar} />
        </>
      ) : null}
      {painel ? <AgendaExames /> : null}
    </main>
  );
}
