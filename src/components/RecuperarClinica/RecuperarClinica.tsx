"use client";

import Link from "next/link";
import { useState } from "react";
import { api } from "@/hook/api";
import { mensagemDeErro } from "@/lib/erros";

export default function RecuperarClinica({ token }: { token: string | null }) {
  const [form, setForm] = useState({ cnpj: "", email: "", representante: "", relato: "" });
  const [aviso, setAviso] = useState("");
  const [enviando, setEnviando] = useState(false);
  async function enviar() {
    setEnviando(true); setAviso("");
    try {
      const resposta = await api.post(token ? "/recuperacao-cnpj/verificar" : "/recuperacao-cnpj", token ? { token } : form);
      setAviso(resposta.data.message);
    } catch (erro) { setAviso(mensagemDeErro(erro, "Não foi possível enviar. Tente novamente.")); }
    finally { setEnviando(false); }
  }
  return <main className="mx-auto flex max-w-2xl flex-col gap-5 px-4 pb-16 pt-32">
    <h1 className="text-2xl font-bold">Recuperar acesso à clínica ou laboratório</h1>
    <p>Se o CNPJ já foi cadastrado, a recuperação exige confirmação do seu e-mail e análise manual da representação da empresa. Enviar a solicitação não concede acesso.</p>
    {aviso ? <p role="status" className="rounded-xl bg-orange-50 p-4">{aviso}</p> : null}
    {token ? <button type="button" disabled={enviando} onClick={enviar} className="rounded-xl bg-orange-500 p-3 font-bold text-white disabled:opacity-50">Confirmar meu e-mail</button> :
      <form onSubmit={e => { e.preventDefault(); void enviar(); }} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1">CNPJ<input required maxLength={18} value={form.cnpj} onChange={e => setForm({ ...form, cnpj: e.target.value })} className="rounded-lg border p-3" /></label>
        <label className="flex flex-col gap-1">Nome do representante<input required minLength={3} maxLength={255} autoComplete="name" value={form.representante} onChange={e => setForm({ ...form, representante: e.target.value })} className="rounded-lg border p-3" /></label>
        <label className="flex flex-col gap-1">Novo e-mail de acesso<input required type="email" maxLength={255} autoComplete="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} className="rounded-lg border p-3" /></label>
        <p className="text-sm text-slate-600">Use um e-mail ainda não cadastrado. Se você ainda acessa o e-mail original, use <Link href="/forgot-password" className="underline">Esqueci minha senha</Link>.</p>
        <label className="flex flex-col gap-1">Descreva sua relação com a empresa<textarea required minLength={20} maxLength={2000} rows={4} value={form.relato} onChange={e => setForm({ ...form, relato: e.target.value })} className="rounded-lg border p-3" /></label>
        <p className="text-sm text-slate-600">Não inclua senhas ou documentos pessoais neste campo. A equipe solicitará a comprovação por canal apropriado durante a análise.</p>
        <button disabled={enviando} className="rounded-xl bg-orange-500 p-3 font-bold text-white disabled:opacity-50">{enviando ? "Enviando..." : "Solicitar análise"}</button>
      </form>}
  </main>;
}
