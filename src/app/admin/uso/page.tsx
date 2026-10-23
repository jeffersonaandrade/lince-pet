import { headers } from 'next/headers'
import { NextRequest } from 'next/server'
import { redirect } from 'next/navigation'
import { Database } from 'lucide-react'
import AdminNav from '@/components/AdminNav/AdminNav'
import PainelCapacidade from '@/components/AdminCapacidade/AdminCapacidade'
import { requireAdmin } from '@/server/auth/session'
import { ApiRequest, HttpError } from '@/server/http'
import { urlDeLogin } from '@/lib/destino-login'

export default async function UsoAdminPage() {
  try {
    // Transporta os headers para o autenticador existente; não realiza chamada HTTP.
    const request = new NextRequest('http://lincepet.local/admin/uso', { headers: await headers() })
    await requireAdmin(await ApiRequest.from(request))
  } catch (error) {
    if (error instanceof HttpError && error.status === 401) redirect(urlDeLogin('/admin/uso'))
    if (error instanceof HttpError && error.status === 403) {
      return <main className="mx-auto max-w-3xl px-4 pb-16 pt-28"><p className="rounded-xl border border-slate-200 bg-white p-6 text-slate-600">Esta área é restrita ao administrador da Lince Pet.</p></main>
    }
    throw error
  }
  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-6 px-4 pb-16 pt-28">
      <AdminNav />
      <header className="flex items-center gap-3">
        <span className="rounded-xl bg-orange-100 p-3 text-orange-700"><Database size={24} aria-hidden="true" /></span>
        <div><h1 className="text-2xl font-bold text-slate-800">Uso de dados</h1><p className="mt-1 text-sm text-slate-500">Acompanhe o espaço ocupado e planeje a ampliação da infraestrutura.</p></div>
      </header>
      <PainelCapacidade />
    </main>
  )
}
