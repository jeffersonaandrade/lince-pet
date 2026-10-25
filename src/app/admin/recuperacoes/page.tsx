import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { NextRequest } from 'next/server'
import { ApiRequest, HttpError } from '@/server/http'
import { requireAdmin } from '@/server/auth/session'
import { urlDeLogin } from '@/lib/destino-login'
import AdminNav from '@/components/AdminNav/AdminNav'
import AdminRecuperacoes from '@/components/AdminRecuperacoes/AdminRecuperacoes'
import { listarRecuperacoes } from '@/server/services/recuperacao-cnpj'

export default async function RecuperacoesPage() {
  try {
    await requireAdmin(await ApiRequest.from(new NextRequest('http://lincepet.local/admin/recuperacoes', { headers: await headers() })))
  } catch (erro) {
    if (erro instanceof HttpError && erro.status === 401) redirect(urlDeLogin('/admin/recuperacoes'))
    if (erro instanceof HttpError && erro.status === 403) return <main className="px-4 pt-32">Área restrita ao administrador da Lince Pet.</main>
    throw erro
  }
  const pedidos = (await listarRecuperacoes()).map(p => ({ ...p, decididoEm: p.decididoEm?.toISOString() ?? null }))
  return <main className="mx-auto flex max-w-4xl flex-col gap-5 px-4 pb-16 pt-32"><AdminNav /><h1 className="text-2xl font-bold">Recuperação de CNPJ</h1><p>Aprove somente após comprovar a representação. A decisão fica registrada e altera o acesso à conta original.</p><AdminRecuperacoes iniciais={pedidos} /></main>
}
