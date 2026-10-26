"use client";
import { useEffect, useState, type FormEvent } from 'react';
import { isAxiosError } from 'axios';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/hook/api';
import { CAMPOS_ENDERECO_TUTOR } from '@/lib/endereco-tutor';
const labels = { cep: 'CEP', rua: 'Rua', numero: 'Número', bairro: 'Bairro (opcional)', cidade: 'Cidade', estado: 'Estado (UF)' };
export default function EnderecoTutor() {
  const { user, checkAuth } = useAuth();
  const [endereco, setEndereco] = useState<Record<string, string>>({});
  const [celular, setCelular] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [aviso, setAviso] = useState('');
  const [erro, setErro] = useState(false);
  useEffect(() => {
    if (!user) return;
    setEndereco(Object.fromEntries(CAMPOS_ENDERECO_TUTOR.map(k => [k, user[k] ?? ''])));
    setCelular(user.celular ?? '');
  }, [user]);
  async function salvar(e: FormEvent) {
    e.preventDefault(); setOcupado(true); setAviso('');
    try { await api.put('/tutor/profile', { endereco, celular }); await checkAuth(); setErro(false); setAviso('Endereço do tutor salvo.'); }
    catch (e) { setErro(true); setAviso(isAxiosError(e) && typeof e.response?.data?.message === 'string' ? e.response.data.message : 'Não foi possível salvar o endereço.'); }
    finally { setOcupado(false); }
  }
  const campo = 'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-[var(--primary)] focus:outline-none focus:ring-2 focus:ring-[var(--primary-light)]';
  return <section className="my-5 rounded-xl border border-slate-200 bg-white p-5" aria-labelledby="endereco-tutor-titulo">
    <h2 id="endereco-tutor-titulo" className="text-xl font-bold text-slate-800">Endereço para atendimento a domicílio</h2>
    <p className="my-3 text-sm text-slate-500">Este endereço pertence ao perfil de tutor e não altera seu local de trabalho em outros perfis.</p>
    <form onSubmit={salvar} className="flex flex-col gap-4"><fieldset disabled={ocupado} className="grid gap-3 border-0 p-0 sm:grid-cols-2">
      {CAMPOS_ENDERECO_TUTOR.map(k => <label key={k} className="flex min-w-0 flex-col gap-1 text-sm font-medium">{labels[k]}<input required={k !== 'bairro'} maxLength={k === 'estado' ? 2 : k === 'cep' ? 9 : 255} value={endereco[k] ?? ''} onChange={e => setEndereco({ ...endereco, [k]: e.target.value })} className={campo} /></label>)}
      <label className="flex flex-col gap-1 text-sm font-medium">Celular<input required inputMode="tel" maxLength={15} value={celular} onChange={e => setCelular(e.target.value)} className={campo} /></label>
    </fieldset><button disabled={ocupado} className="self-start rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--primary-dark)] disabled:opacity-50">Salvar endereço do tutor</button></form>
    {aviso ? <p role={erro ? 'alert' : 'status'} className={`mt-3 text-sm ${erro ? 'text-red-700' : 'text-green-700'}`}>{aviso}</p> : null}
  </section>;
}
