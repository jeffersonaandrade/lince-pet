"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { isAxiosError } from "axios";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/hook/api";
import { dashboardDoTipo, rotuloDoTipo } from "@/utils/tipoConta";
import { destinoSeguro, urlDeLogin } from "@/lib/destino-login";

type Perfil = { tipo: string; ativo: boolean };
export default function PerfisPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [perfis, setPerfis] = useState<Perfil[]>([]);
  const [tipos, setTipos] = useState<{ slug: string; nome: string }[]>([]);
  const [servico, setServico] = useState("");
  const [cpf, setCpf] = useState('');
  const [celular, setCelular] = useState('');
  const [sobrenome, setSobrenome] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState("");
  useEffect(() => {
    if (loading) return;
    if (!user) { router.replace(urlDeLogin('/perfis')); return; }
    let vigente = true;
    Promise.all([api.get<Perfil[]>("/auth/perfis"), api.get("/tipos-servico")]).then(([p, t]) => {
      if (!vigente) return;
      setPerfis(p.data);
      const lista = Array.isArray(t.data) ? t.data : t.data.data ?? [];
      setTipos(lista);
    }).catch(() => { if (vigente) setErro("Não foi possível carregar seus perfis. Atualize a página."); });
    return () => { vigente = false; };
  }, [loading, user, router]);
  async function escolher(p: Perfil) {
    setOcupado(true); setErro("");
    try {
      if (!p.ativo) await api.post("/auth/perfis", { tipo: p.tipo, tipo_servico: servico, cpf, celular: celular || user?.celular, sobrenome: sobrenome || user?.sobrenome });
      await api.put("/auth/perfis", { tipo: p.tipo });
      localStorage.setItem("lincepet-perfil-alterado", p.tipo);
      // Recarrega os dados e desmonta a tela anterior para não misturar os contextos.
      const voltar = destinoSeguro(new URLSearchParams(window.location.search).get('voltar'));
      window.location.assign(p.tipo === 'tutor' && voltar !== '/' ? voltar : dashboardDoTipo(p.tipo));
    } catch (e) {
      setErro(isAxiosError(e) && typeof e.response?.data?.message === "string" ? e.response.data.message : "Não foi possível trocar de perfil.");
      setOcupado(false);
    }
  }
  if (loading || !user) return null;
  return <section className="mx-auto flex max-w-4xl flex-col gap-5 px-4 pb-16 pt-28" aria-labelledby="perfis-titulo">
    <h1 id="perfis-titulo" className="text-2xl font-bold text-slate-800">Meus perfis</h1>
    <p className="text-slate-600">Um login, perfis separados. Seus pets e atendimentos permanecem em seus respectivos painéis. Cada perfil profissional mantém seu plano e suas aprovações.</p>
    {erro ? <p role="alert" className="rounded-xl bg-red-50 p-4 text-red-800">{erro}</p> : null}
    {user.userType === 'clinica' ? <p>Clínicas e laboratórios utilizam uma conta separada dos perfis individuais.</p> : <ul className="grid list-none gap-4 sm:grid-cols-3">
      {perfis.map(p => <li key={p.tipo} className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="text-lg font-bold text-slate-800">{rotuloDoTipo(p.tipo)}</h2>
        <p className="text-sm text-slate-500">{p.tipo === 'tutor' ? 'Cuide dos seus pets e agende atendimentos.' : p.tipo === 'veterinario' ? 'Atenda após concluir o cadastro e a aprovação do CRMV.' : 'Ofereça serviços pet após concluir seu cadastro.'}</p>
        {!p.ativo && p.tipo !== 'tutor' ? <div className="flex flex-col gap-2 text-sm">
          <label className="flex flex-col gap-1">CPF<input aria-label={`CPF para ${rotuloDoTipo(p.tipo)}`} inputMode="numeric" autoComplete="off" value={cpf} onChange={e => setCpf(e.target.value)} maxLength={14} className="w-full rounded-lg border border-slate-300 p-2" /></label>
          <label className="flex flex-col gap-1">Sobrenome<input aria-label={`Sobrenome para ${rotuloDoTipo(p.tipo)}`} value={sobrenome || user.sobrenome || ''} onChange={e => setSobrenome(e.target.value)} maxLength={100} className="w-full rounded-lg border border-slate-300 p-2" /></label>
          <label className="flex flex-col gap-1">Celular<input aria-label={`Celular para ${rotuloDoTipo(p.tipo)}`} inputMode="tel" value={celular || user.celular || ''} onChange={e => setCelular(e.target.value)} maxLength={15} className="w-full rounded-lg border border-slate-300 p-2" /></label>
        </div> : null}
        {p.tipo === 'prestador' && !p.ativo ? <label className="flex flex-col gap-1 text-sm">Tipo de serviço<select aria-label="Tipo de serviço" value={servico} onChange={e => setServico(e.target.value)} className="rounded-lg border border-slate-300 p-2"><option value="">Selecione</option>{tipos.map(t => <option key={t.slug} value={t.slug}>{t.nome}</option>)}</select></label> : null}
        <button type="button" disabled={ocupado || p.tipo === user.userType || (!p.ativo && p.tipo === 'prestador' && !servico)} onClick={() => escolher(p)} className="mt-auto rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--primary-dark)] disabled:opacity-50">{p.tipo === user.userType ? 'Perfil atual' : p.ativo ? `Usar como ${rotuloDoTipo(p.tipo).toLowerCase()}` : `Ativar perfil de ${rotuloDoTipo(p.tipo).toLowerCase()}`}</button>
      </li>)}
    </ul>}
    <Link href={dashboardDoTipo(user.userType)} className="text-[var(--primary-dark)] underline">Voltar ao painel</Link>
  </section>;
}
