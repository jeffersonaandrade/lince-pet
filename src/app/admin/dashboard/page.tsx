import { headers } from 'next/headers'
import { NextRequest } from 'next/server'
import { redirect } from 'next/navigation'
import { LayoutDashboard } from 'lucide-react'
import AdminNav from '@/components/AdminNav/AdminNav'
import PainelDashboard from '@/components/AdminDashboard/PainelDashboard'
import { requireAdmin } from '@/server/auth/session'
import { ApiRequest, HttpError } from '@/server/http'
import { urlDeLogin } from '@/lib/destino-login'

export default async function DashboardAdminPage() {
  try {
    const request = new NextRequest('http://lincepet.local/admin/dashboard', { headers: await headers() })
    await requireAdmin(await ApiRequest.from(request))
  } catch (error) {
    if (error instanceof HttpError && error.status === 401) redirect(urlDeLogin('/admin/dashboard'))
    if (error instanceof HttpError && error.status === 403) {
      return <main className="mx-auto max-w-3xl px-4 pb-16 pt-28"><p className="rounded-xl border border-slate-200 bg-white p-6 text-slate-600">Esta área é restrita ao administrador da Lince Pet.</p></main>
    }
    throw error
  }
  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-6 px-4 pb-16 pt-28">
      <AdminNav />
      <header className="flex items-center gap-3">
        <span className="rounded-xl bg-orange-100 p-3 text-orange-700"><LayoutDashboard size={24} aria-hidden="true" /></span>
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Painel</h1>
          <p className="mt-1 text-sm text-slate-500">Filas, contas, agenda do mês e assinaturas ativas.</p>
        </div>
      </header>
      <PainelDashboard />
    </main>
  )
}
