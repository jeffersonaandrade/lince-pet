"use client";

import { useState, type FormEvent } from "react";
import { isAxiosError } from "axios";
import { api } from "@/hook/api";

type Profissao = {
  id: string; nome: string; descricao: string | null; slug: string; modalidade: string; ordem: number; ativo: boolean; vinculos: number; revisao: string;
};
type Formulario = { id?: string; nome: string; descricao: string; slug: string; modalidade: string; ordem: number; ativo: boolean; revisao?: string };
const novo = (): Formulario => ({ nome: "", descricao: "", slug: "", modalidade: "duracao", ordem: 0, ativo: true });
const campo = "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus:border-[var(--primary)] focus:outline-none focus:ring-2 focus:ring-[var(--primary-light)]";
const botao = "rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-50";
const primario = "rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[var(--primary-dark)] disabled:cursor-not-allowed disabled:opacity-60";

export default function AdminProfissoes({ iniciais }: { iniciais: Profissao[] }) {
  const [itens, setItens] = useState(iniciais);
  const [form, setForm] = useState<Formulario | null>(null);
  const [busca, setBusca] = useState("");
  const [status, setStatus] = useState("todas");
  const [ocupado, setOcupado] = useState(false);
  const [aviso, setAviso] = useState<{ texto: string; erro?: boolean } | null>(null);
  const termo = busca.trim().toLocaleLowerCase("pt-BR");
  const filtrados = itens.filter(e => e.nome.toLocaleLowerCase("pt-BR").includes(termo)
    && (status === "todas" || (status === "ativas" ? e.ativo : !e.ativo)));

  async function carregar() {
    const resposta = await api.get<Profissao[]>("/admin/profissoes");
    setItens(resposta.data);
  }

  function erro(e: unknown) {
    setAviso({ erro: true, texto: isAxiosError(e) && typeof e.response?.data?.message === "string"
      ? e.response.data.message : "Não foi possível concluir a operação. Atualize a lista e tente novamente." });
  }

  async function atualizarLista() {
    setOcupado(true);
    setAviso(null);
    try { await carregar(); setForm(null); } catch (e) { erro(e); } finally { setOcupado(false); }
  }

  async function salvar(event: FormEvent) {
    event.preventDefault();
    if (!form || ocupado) return;
    setOcupado(true);
    setAviso(null);
    try {
      if (form.id) await api.put(`/admin/profissoes/${form.id}`, form);
      else await api.post("/admin/profissoes", form);
      setForm(null);
      // A gravação já aconteceu: se a leitura falhar, não oferecer um segundo envio do formulário.
      try { await carregar(); setAviso({ texto: "Profissao salva." }); }
      catch { setAviso({ texto: "Profissao salva, mas a lista não foi atualizada. Clique em Atualizar lista.", erro: true }); }
    } catch (e) { erro(e); } finally { setOcupado(false); }
  }

  async function alternar(e: Profissao) {
    if (ocupado) return;
    if (e.ativo && !window.confirm(`Inativar ${e.nome}? Os ${e.vinculos} vínculo(s) serão preservados.`)) return;
    setOcupado(true);
    setAviso(null);
    try {
      if (e.ativo) await api.delete(`/admin/profissoes/${e.id}`, { data: { revisao: e.revisao } });
      else await api.put(`/admin/profissoes/${e.id}`, { ...e, ativo: true });
      setForm(null);
      try { await carregar(); setAviso({ texto: e.ativo ? "Profissao inativada." : "Profissao reativada." }); }
      catch { setAviso({ texto: "Alteração salva, mas a lista não foi atualizada. Clique em Atualizar lista.", erro: true }); }
    } catch (e) { erro(e); } finally { setOcupado(false); }
  }

  return (
    <div className="flex flex-col gap-5" aria-busy={ocupado}>
      <div className="flex flex-wrap gap-3">
        <button type="button" disabled={ocupado} onClick={() => { setForm(novo()); setAviso(null); }}
          className={primario}>Nova profissão</button>
        <button type="button" disabled={ocupado} onClick={atualizarLista} className={botao}>Atualizar lista</button>
      </div>
      {aviso ? <p role={aviso.erro ? "alert" : "status"} className={`rounded-lg p-3 ${aviso.erro ? "bg-red-50 text-red-800" : "bg-green-50 text-green-800"}`}>{aviso.texto}</p> : null}
      {form ? (
        <form onSubmit={salvar} className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-5" aria-label={form.id ? "Editar profissão" : "Nova profissão"}>
          <h2 className="text-lg font-bold">{form.id ? "Editar profissão" : "Nova profissão"}</h2>
          <label className="flex flex-col gap-1 font-medium">Nome
            <input required minLength={2} maxLength={100} autoFocus disabled={ocupado} value={form.nome} onChange={e => setForm({ ...form, nome: e.target.value })} className={campo} />
          </label>
          <label className="flex flex-col gap-1 font-medium">Identificador (não muda depois de cadastrar)
            <input required maxLength={50} pattern="[a-z0-9]+([-_][a-z0-9]+)*" disabled={ocupado || !!form.id} value={form.slug} onChange={e => setForm({ ...form, slug: e.target.value })} className={campo} />
          </label>
          <label className="flex flex-col gap-1 font-medium">Modalidade
            <select disabled={ocupado || itens.some(e => e.id === form.id && e.vinculos > 0)} value={form.modalidade} onChange={e => setForm({ ...form, modalidade: e.target.value })} className={campo}>
              <option value="duracao">Por duração (minutos)</option><option value="periodo">Por período (diárias)</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 font-medium">Ordem de apresentação
            <input type="number" min={0} max={9999} required disabled={ocupado} value={form.ordem} onChange={e => setForm({ ...form, ordem: Number(e.target.value) })} className={campo} />
          </label>
          <label className="flex flex-col gap-1 font-medium">Descrição (opcional)
            <textarea rows={3} maxLength={255} disabled={ocupado} value={form.descricao} onChange={e => setForm({ ...form, descricao: e.target.value })} className={campo} />
          </label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={form.ativo} disabled={ocupado} onChange={e => setForm({ ...form, ativo: e.target.checked })} />Ativa</label>
          <div className="flex gap-3">
            <button type="submit" disabled={ocupado} className={primario}>{ocupado ? "Salvando…" : "Salvar profissão"}</button>
            <button type="button" disabled={ocupado} onClick={() => setForm(null)} className={botao}>Cancelar</button>
          </div>
        </form>
      ) : null}
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex min-w-0 flex-1 flex-col gap-1 text-sm font-medium">Buscar profissão
          <input type="search" value={busca} onChange={e => setBusca(e.target.value)} className={campo} />
        </label>
        <div className="flex flex-col gap-1 text-sm font-medium">
          <label htmlFor="profissoes-status">Status</label>
          <select id="profissoes-status" value={status} onChange={e => setStatus(e.target.value)} className={campo}><option value="todas">Todas</option><option value="ativas">Ativas</option><option value="inativas">Inativas</option></select>
        </div>
      </div>
      <p className="text-sm text-slate-600" aria-live="polite">{filtrados.length} de {itens.length} profissoes</p>
      {filtrados.length ? <ul className="flex flex-col gap-3">
        {filtrados.map(e => <li key={e.id} aria-label={e.nome} className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0 flex-1 break-words">
            <h2 className="text-base font-bold text-slate-800">{e.nome}</h2>
            {e.descricao ? <p className="mt-1 whitespace-pre-wrap text-sm text-slate-600">{e.descricao}</p> : null}
            <p className="mt-1 text-sm text-slate-500">{e.ativo ? "Ativa" : "Inativa"} · {e.vinculos} profissional(is) · {e.modalidade === "periodo" ? "Por período" : "Por duração"} · Ordem {e.ordem}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" disabled={ocupado} className={botao} aria-label={`Editar ${e.nome}`} onClick={() => { setForm({ ...e, descricao: e.descricao ?? "" }); setAviso(null); window.scrollTo({ top: 0, behavior: "smooth" }); }}>Editar</button>
            <button type="button" disabled={ocupado} className={botao} aria-label={`${e.ativo ? "Inativar" : "Reativar"} ${e.nome}`} onClick={() => alternar(e)}>{e.ativo ? "Inativar" : "Reativar"}</button>
          </div>
        </li>)}
      </ul> : <p className="rounded-xl border border-dashed border-slate-300 p-5 text-slate-600">Nenhuma profissão encontrada.</p>}
    </div>
  );
}
