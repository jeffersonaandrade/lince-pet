import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { NextRequest } from 'next/server'
import { Stethoscope } from 'lucide-react'
import { ApiRequest, HttpError } from '@/server/http'
import { requireAdmin } from '@/server/auth/session'
import { urlDeLogin } from '@/lib/destino-login'
import AdminNav from '@/components/AdminNav/AdminNav'
import AdminEspecialidades from '@/components/AdminEspecialidades/AdminEspecialidades'
import { listarEspecialidadesAdmin } from '@/server/services/admin-especialidades'

export default async function EspecialidadesPage() {
  try {
    await requireAdmin(await ApiRequest.from(new NextRequest('http://lincepet.local/admin/especialidades', { headers: await headers() })))
  } catch (erro) {
    if (erro instanceof HttpError && erro.status === 401) redirect(urlDeLogin('/admin/especialidades'))
    if (erro instanceof HttpError && erro.status === 403) return <section className="mx-auto max-w-3xl px-4 pb-16 pt-28"><p className="rounded-xl border border-slate-200 bg-white p-6 text-slate-600">Esta área é restrita ao administrador da Lince Pet.</p></section>
    throw erro
  }
  const iniciais = await listarEspecialidadesAdmin()
  return (
    <section aria-labelledby="especialidades-titulo" className="mx-auto flex max-w-5xl flex-col gap-6 px-4 pb-16 pt-28">
      <AdminNav />
      <header className="flex items-center gap-3">
        <span className="rounded-xl bg-[var(--primary-light)] p-3 text-[var(--primary-dark)]"><Stethoscope size={24} aria-hidden="true" /></span>
        <div><h1 id="especialidades-titulo" className="text-2xl font-bold text-slate-800">Especialidades</h1><p className="mt-1 text-sm text-slate-500">Gerencie as opções disponíveis no cadastro e na busca.</p></div>
      </header>
      <p className="text-sm text-slate-600">Inativar retira a opção das listas de seleção e preserva os vínculos existentes.</p>
      <AdminEspecialidades iniciais={iniciais} />
    </section>
  )
}
