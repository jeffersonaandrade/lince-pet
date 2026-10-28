"use client";
import { useEffect } from 'react'

/** Só leitura, uma requisição por vez, até 2 minutos visíveis; retoma ao voltar à aba. */
export function useAcompanharPagamento(ativo: boolean, atualizar: () => Promise<void>) {
  useEffect(() => {
    if (!ativo) return
    let encerrado = false, emAndamento = false, limite = Date.now() + 120_000
    let timer: ReturnType<typeof setTimeout> | undefined
    const conferir = async () => {
      if (encerrado || emAndamento || document.visibilityState === 'hidden' || Date.now() >= limite) return
      emAndamento = true
      try { await atualizar() } catch { /* O estado continua pendente; a UI oferece atualização manual. */ }
      finally {
        emAndamento = false
        if (!encerrado && Date.now() < limite) timer = setTimeout(conferir, 10_000)
      }
    }
    const retomar = () => {
      if (document.visibilityState === 'hidden' || emAndamento) return
      clearTimeout(timer)
      limite = Date.now() + 120_000
      void conferir()
    }
    timer = setTimeout(conferir, 10_000)
    window.addEventListener('focus', retomar)
    document.addEventListener('visibilitychange', retomar)
    return () => { encerrado = true; clearTimeout(timer); window.removeEventListener('focus', retomar); document.removeEventListener('visibilitychange', retomar) }
  }, [ativo, atualizar])
}
