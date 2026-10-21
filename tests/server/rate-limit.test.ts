import { describe, it, expect, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { limitarTentativas, limparLimites, type Limite } from '@/server/rate-limit'

const LIMITE: Limite = { nome: 'teste', max: 3, janelaMs: 60_000 }
const req = (ip: string) => new NextRequest('http://x/api/auth/login', { headers: { 'x-forwarded-for': `${ip}, 10.0.0.1` } })

beforeEach(() => limparLimites())

describe('limitarTentativas', () => {
  it('bloqueia com 429 depois do máximo na janela, por IP', () => {
    for (let i = 0; i < 3; i++) limitarTentativas(req('1.1.1.1'), LIMITE, 1000)
    expect(() => limitarTentativas(req('1.1.1.1'), LIMITE, 1000)).toThrow(expect.objectContaining({ status: 429 }))
    expect(() => limitarTentativas(req('2.2.2.2'), LIMITE, 1000)).not.toThrow()
  })

  it('libera de novo quando a janela vira', () => {
    for (let i = 0; i < 3; i++) limitarTentativas(req('1.1.1.1'), LIMITE, 1000)
    expect(() => limitarTentativas(req('1.1.1.1'), LIMITE, 1000 + 60_000)).not.toThrow()
  })
})
