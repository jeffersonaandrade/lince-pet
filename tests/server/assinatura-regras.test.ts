import { describe, it, expect } from 'vitest'
import {
  dataLocal,
  fimDoPeriodo,
  planoServePara,
  podeVincularVet,
  statusLabel,
  temDireitoAoTeste,
  webhookAutorizado,
} from '@/server/services/assinatura-regras'

describe('regras de assinatura', () => {
  it('status local vira o rótulo do card', () => {
    expect(statusLabel('active')).toBe('ativa')
    expect(statusLabel('pending')).toBe('pendente')
    expect(statusLabel('canceled')).toBe('cancelada')
    expect(statusLabel('expired')).toBe('cancelada')
    expect(statusLabel('past_due')).toBe('inadimplente')
    expect(statusLabel(null)).toBeNull()
  })

  it('teste grátis só na primeira assinatura paga', () => {
    expect(temDireitoAoTeste(14, false)).toBe(true)
    expect(temDireitoAoTeste(14, true)).toBe(false)
    expect(temDireitoAoTeste(0, false)).toBe(false)
  })

  it('cada tipo só contrata os próprios planos', () => {
    expect(planoServePara('vet_pro', 'veterinario')).toBe(true)
    expect(planoServePara('pro', 'veterinario')).toBe(false)
    expect(planoServePara('starter', 'clinica')).toBe(true)
    expect(planoServePara('vet_starter', 'clinica')).toBe(false)
    expect(planoServePara('pro', 'prestador')).toBe(true)
  })

  it('período pago vai do vencimento até um mês depois', () => {
    expect(fimDoPeriodo('2026-10-09').toISOString()).toBe('2026-11-09T23:59:59.000Z')
    expect(fimDoPeriodo('2026-12-15').toISOString()).toBe('2027-01-15T23:59:59.000Z')
  })

  it('data do Asaas usa o fuso de Brasília', () => {
    expect(dataLocal(new Date('2026-10-10T01:00:00Z'))).toBe('2026-10-09')
  })

  it('limite de vets da clínica', () => {
    expect(podeVincularVet(5, 0, false).ok).toBe(false)
    expect(podeVincularVet(5, 5, true).ok).toBe(false)
    expect(podeVincularVet(5, 4, true).ok).toBe(true)
    expect(podeVincularVet(null, 999, true).ok).toBe(true)
  })

  it('token do webhook é obrigatório em produção', () => {
    expect(webhookAutorizado(undefined, undefined, 'production')).toBe(false)
    expect(webhookAutorizado(undefined, undefined, 'sandbox')).toBe(true)
    expect(webhookAutorizado('t'.repeat(32), 'errado', 'sandbox')).toBe(false)
    expect(webhookAutorizado('t'.repeat(32), 't'.repeat(32), 'production')).toBe(true)
  })
})
