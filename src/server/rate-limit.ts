import 'server-only'
import type { NextRequest } from 'next/server'
import { HttpError } from './http'

/**
 * Limite de tentativas por IP em memória (janela fixa). Vale por instância do servidor: freia força bruta
 * e abuso de e-mail sem depender de serviço externo. Mais de uma instância = limite por instância.
 */
type Janela = { inicio: number; total: number }

const janelas = new Map<string, Janela>()
const MAX_CHAVES = 10_000

export type Limite = { nome: string; max: number; janelaMs: number }

export const LIMITES = {
  login: { nome: 'login', max: 10, janelaMs: 15 * 60_000 },
  senha: { nome: 'senha', max: 5, janelaMs: 15 * 60_000 },
  cadastro: { nome: 'cadastro', max: 10, janelaMs: 60 * 60_000 },
} satisfies Record<string, Limite>

export function ipDaRequisicao(req: NextRequest) {
  const encaminhado = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
  return encaminhado || req.headers.get('x-real-ip') || 'desconhecido'
}

function limparVencidas(agora: number) {
  for (const [chave, j] of janelas) {
    if (agora - j.inicio > 60 * 60_000) janelas.delete(chave)
  }
}

/** Conta a tentativa e lança 429 quando passa do limite da janela. */
export function limitarTentativas(req: NextRequest, limite: Limite, agora = Date.now()) {
  const chave = `${limite.nome}:${ipDaRequisicao(req)}`
  if (janelas.size > MAX_CHAVES) limparVencidas(agora)

  const atual = janelas.get(chave)
  if (!atual || agora - atual.inicio >= limite.janelaMs) {
    janelas.set(chave, { inicio: agora, total: 1 })
    return
  }
  atual.total += 1
  if (atual.total > limite.max) {
    const segundos = Math.ceil((atual.inicio + limite.janelaMs - agora) / 1000)
    throw new HttpError(429, { message: 'Muitas tentativas. Tente novamente em alguns minutos.', retryAfter: segundos })
  }
}

/** Só para testes. */
export const limparLimites = () => janelas.clear()
