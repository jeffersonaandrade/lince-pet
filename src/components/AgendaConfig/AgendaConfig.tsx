"use client";
import { useEffect, useState, type FormEvent } from "react";
import { isAxiosError } from "axios";
import { api } from "@/hook/api";
import { DIAS_SEMANA } from "@/lib/horarios";

type Config = { duracaoPresencialMin: number; duracaoOnlineMin: number; duracaoDomicilioMin: number; deslocamentoMin: number; atendeDomicilio: boolean; precoConsultaDomicilio: number; horariosDomicilio: Record<string, string[]> };
const campo = "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus:border-[var(--primary)] focus:outline-none focus:ring-2 focus:ring-[var(--primary-light)]";
const dias = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
const horarios = Array.from({ length: 48 }, (_, i) => `${String(Math.floor(i / 2)).padStart(2, '0')}:${i % 2 ? '30' : '00'}`);

export default function AgendaConfig({ onDomicilioAlterado }: { onDomicilioAlterado?: (ativo: boolean) => void }) {
  const [config, setConfig] = useState<Config | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [aviso, setAviso] = useState<{ texto: string; erro?: boolean } | null>(null);
  useEffect(() => {
    let vigente = true;
    api.get<Config>('/veterinarios/agenda-config').then(r => { if (vigente) { setConfig(r.data); onDomicilioAlterado?.(r.data.atendeDomicilio); } })
      .catch(() => { if (vigente) setAviso({ texto: 'Não foi possível carregar a configuração da agenda. Atualize a página.', erro: true }); });
    return () => { vigente = false; };
  }, [onDomicilioAlterado]);
  async function salvar(e: FormEvent) {
    e.preventDefault();
    if (!config) return;
    setSalvando(true); setAviso(null);
    try { const r = await api.put('/veterinarios/agenda-config', config); onDomicilioAlterado?.(config.atendeDomicilio); setAviso({ texto: r.data.message }); }
    catch (e) { setAviso({ texto: isAxiosError(e) && typeof e.response?.data?.message === 'string' ? e.response.data.message : 'Não foi possível salvar a agenda.', erro: true }); }
    finally { setSalvando(false); }
  }
  return <section aria-labelledby="agenda-config-titulo" className="flex flex-col gap-4">
    <h2 id="agenda-config-titulo" className="text-xl font-bold text-slate-800">Duração e atendimento a domicílio</h2>
    <p className="text-sm text-slate-500">Os perfis de veterinário e prestador compartilham a disponibilidade. Uma reserva em um perfil impede outra no mesmo período.</p>
    {aviso ? <p role={aviso.erro ? 'alert' : 'status'} className={`rounded-lg p-3 text-sm ${aviso.erro ? 'bg-red-50 text-red-800' : 'bg-green-50 text-green-800'}`}>{aviso.texto}</p> : null}
    {config ? <form onSubmit={salvar} className="flex flex-col gap-4">
      <fieldset disabled={salvando} className="grid gap-3 border-0 p-0 sm:grid-cols-3">
        {([['duracaoPresencialMin', 'Consulta presencial (min)'], ['duracaoOnlineMin', 'Teleconsulta (min)'], ['duracaoDomicilioMin', 'Consulta domiciliar (min)']] as const).map(([key, label]) => <label key={key} className="flex flex-col gap-1 text-sm font-medium">{label}<input type="number" required min={15} max={240} step={1} value={config[key]} onChange={e => setConfig({ ...config, [key]: Number(e.target.value) })} className={campo} /></label>)}
      </fieldset>
      <label className="flex items-center gap-2 text-sm font-medium"><input type="checkbox" disabled={salvando} checked={config.atendeDomicilio} onChange={e => setConfig({ ...config, atendeDomicilio: e.target.checked })} />Atendo a domicílio</label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm font-medium">Deslocamento entre atendimentos (min)<input type="number" required min={0} max={240} disabled={salvando} value={config.deslocamentoMin} onChange={e => setConfig({ ...config, deslocamentoMin: Number(e.target.value) })} className={campo} /></label>
        <label className="flex flex-col gap-1 text-sm font-medium">Preço da consulta domiciliar (R$)<input type="number" required min={config.atendeDomicilio ? 0.01 : 0} step="0.01" max={999999} disabled={salvando} value={config.precoConsultaDomicilio} onChange={e => setConfig({ ...config, precoConsultaDomicilio: Number(e.target.value) })} className={campo} /></label>
      </div>
      <p className="text-sm text-slate-500">O deslocamento é reservado antes e depois do atendimento domiciliar. Entre duas consultas usamos o maior intervalo necessário, sem somá-lo duas vezes. A grade mantém os horários cadastrados.</p>
      {config.atendeDomicilio ? <fieldset disabled={salvando} className="flex flex-col gap-2 rounded-lg border border-slate-200 p-3"><legend className="px-1 text-sm font-semibold">Grade domiciliar — blocos de 30 minutos</legend>
        <p className="text-sm text-slate-500">Marque blocos consecutivos suficientes para a duração da consulta. Para uma consulta de 60 minutos às 15h, marque 15h e 15h30.</p>
        {DIAS_SEMANA.map((dia, i) => <details key={dia} className="rounded-lg border border-slate-200 p-3"><summary className="cursor-pointer text-sm font-semibold">{dias[i]} ({config.horariosDomicilio[dia]?.length ?? 0} blocos)</summary><div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-6">{horarios.map(h => <label key={h} className="flex items-center gap-2 text-sm"><input type="checkbox" aria-label={`${dias[i]} ${h}`} checked={config.horariosDomicilio[dia]?.includes(h) ?? false} onChange={e => {
          const atual = config.horariosDomicilio[dia] ?? [];
          setConfig({ ...config, horariosDomicilio: { ...config.horariosDomicilio, [dia]: e.target.checked ? [...atual, h].sort() : atual.filter(x => x !== h) } });
        }} />{h}</label>)}</div></details>)}
      </fieldset> : null}
      <p className="text-sm text-slate-500">As mudanças não alteram consultas já reservadas. Novas reservas e remarcações respeitarão a disponibilidade atual.</p>
      <button type="submit" disabled={salvando} className="self-start rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--primary-dark)] disabled:opacity-50">{salvando ? 'Salvando agenda…' : 'Salvar configuração da agenda'}</button>
    </form> : !aviso ? <p role="status">Carregando configuração…</p> : null}
  </section>;
}
