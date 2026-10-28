"use client";

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { CircleCheck, Clock3 } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { urlDeLogin } from '@/lib/destino-login'
import { destinoAposPagamento } from '@/lib/pagamento-navegacao'
import { AssinaturasService, type StatusAssinatura } from '@/services/assinaturas/assinaturas'
import { useAcompanharPagamento } from '@/hook/useAcompanharPagamento'

export default function RetornoPagamento() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const [status, setStatus] = useState<StatusAssinatura | null>(null)
  const [erro, setErro] = useState(false)
  const [consultando, setConsultando] = useState(true)
  const emAndamento = useRef(false)
  const atualizar = useCallback(async () => {
    if (emAndamento.current) return
    emAndamento.current = true
    try { setStatus(await AssinaturasService().obterStatus({ incluirFatura: false })); setErro(false) }
    catch { setErro(true) }
    finally { emAndamento.current = false; setConsultando(false) }
  }, [])
  const ativo = Boolean(status?.subscription?.status === 'active' && !status.emTeste && !status.pendingPlanId && !status.cancelamentoPendente && !status.checkoutUrl)
  const cancelada = Boolean(status?.cancelamentoPendente || ['canceled', 'expired', 'cancel_pending'].includes(status?.subscription?.status || ''))
  const destino = user ? destinoAposPagamento(user) : '/'
  useEffect(() => {
    if (loading) return
    if (!user) { router.replace(urlDeLogin('/pagamento/retorno')); return }
    if (!['veterinario', 'clinica', 'prestador'].includes(user.userType)) { router.replace('/'); return }
    void atualizar()
  }, [user, loading, router, atualizar])
  useAcompanharPagamento(Boolean(user && !ativo && !cancelada), atualizar)
  useEffect(() => {
    if (!ativo) return
    const timer = setTimeout(() => router.replace(destino), 1500)
    return () => clearTimeout(timer)
  }, [ativo, destino, router])
  return <main className="mx-auto max-w-xl px-4 py-12">
    <section aria-label="Retorno do pagamento" className="space-y-5 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
      {ativo ? <CircleCheck size={44} className="text-emerald-600" /> : <Clock3 size={44} className="text-orange-500" />}
      <h1 className="text-2xl font-bold text-slate-800">{ativo ? 'Seu plano está ativo!' : cancelada ? 'Confira a situação da assinatura' : 'Estamos acompanhando seu pagamento'}</h1>
      <p role="status" className="text-sm text-slate-600">{ativo ? `${status?.plan?.name || 'Plano'} disponível. Você será levado automaticamente para continuar na LincePet.` : cancelada ? 'A assinatura está encerrada ou em cancelamento. Confira os detalhes no seu painel.' : 'Você já está de volta à LincePet. Assim que recebermos a confirmação, atualizaremos seu plano automaticamente.'}</p>
      {!ativo && !cancelada ? <p className="text-sm text-slate-500">Pix e cartão podem levar alguns instantes para confirmar. Se escolheu boleto, aguarde a compensação. Você pode continuar usando sua conta enquanto isso.</p> : null}
      {erro ? <p role="alert" className="rounded-xl bg-amber-50 p-3 text-sm text-amber-800">Não conseguimos consultar a situação agora. Isso não significa que o pagamento falhou. Tente atualizar novamente.</p> : null}
      {!ativo ? <button type="button" onClick={() => { setConsultando(true); void atualizar() }} disabled={consultando || loading} className="w-full rounded-xl bg-[var(--primary)] p-3 font-semibold text-white disabled:opacity-50">{consultando ? 'Consultando...' : 'Atualizar situação'}</button> : null}
      <Link href={destino} className="inline-block text-sm font-semibold text-orange-600 hover:underline">{user && !user.onboardingComplete ? 'Continuar meu cadastro' : 'Ir para meu painel'}</Link>
    </section>
  </main>
}
