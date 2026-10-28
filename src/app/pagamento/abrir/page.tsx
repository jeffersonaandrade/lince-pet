"use client";

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ShieldCheck, LoaderCircle } from 'lucide-react'
import Link from 'next/link'
import { useAuth } from '@/contexts/AuthContext'
import { urlDeLogin } from '@/lib/destino-login'
import { urlFaturaAsaas } from '@/lib/pagamento-navegacao'
import { AssinaturasService } from '@/services/assinaturas/assinaturas'

export default function AbrirPagamento() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const iniciou = useRef(false)
  const [erro, setErro] = useState(false)
  const preparar = useCallback(async () => {
    setErro(false)
    try {
      const resposta = await AssinaturasService().prepararPagamento()
      if (!resposta.checkoutUrl) { router.replace('/pagamento/retorno'); return }
      const url = urlFaturaAsaas(resposta.checkoutUrl)
      if (!url) throw new Error('Destino inválido')
      window.location.replace(url)
    } catch { setErro(true) }
  }, [router])
  useEffect(() => {
    if (loading) return
    if (!user) { router.replace(urlDeLogin('/pagamento/abrir')); return }
    if (!['veterinario', 'clinica', 'prestador'].includes(user.userType)) { router.replace('/'); return }
    if (!iniciou.current) { iniciou.current = true; void preparar() }
  }, [user, loading, router, preparar])
  return <main className="mx-auto max-w-xl px-4 py-12">
    <section className="space-y-5 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
      <ShieldCheck size={40} className="text-orange-500" />
      <h1 className="text-2xl font-bold text-slate-800">{erro ? 'Não foi possível abrir o pagamento' : 'Preparando seu pagamento'}</h1>
      {erro ? <>
        <p role="alert" className="text-sm text-slate-600">O Asaas não respondeu como esperado. Sua conta continua disponível na LincePet. Tente abrir a mesma cobrança novamente.</p>
        <button type="button" onClick={preparar} className="w-full rounded-xl bg-[var(--primary)] p-3 font-semibold text-white">Tentar novamente</button>
      </> : <p role="status" className="flex items-center gap-2 text-sm text-slate-600"><LoaderCircle size={20} className="shrink-0 animate-spin" />Você será encaminhado ao ambiente seguro do Asaas nesta aba.</p>}
      <p className="text-sm text-slate-500">A página anterior da LincePet continua aberta. Após pagar por uma forma com confirmação imediata, você retorna automaticamente ao site.</p>
      <Link href="/pagamento/retorno" className="inline-block text-sm font-semibold text-orange-600 hover:underline">Acompanhar minha assinatura</Link>
    </section>
  </main>
}
