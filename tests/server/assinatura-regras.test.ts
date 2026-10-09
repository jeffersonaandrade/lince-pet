import { describe, it, expect } from 'vitest'
import {
  dataLocal,
  fimDoPeriodo,
  planoServePara,
  podeVincularVet,
  somarDias,
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

  it('período pago não estoura o mês seguinte', () => {
    expect(fimDoPeriodo('2026-01-31').toISOString()).toBe('2026-02-28T23:59:59.000Z')
    expect(fimDoPeriodo('2028-01-31').toISOString()).toBe('2028-02-29T23:59:59.000Z')
    expect(fimDoPeriodo('2026-03-31').toISOString()).toBe('2026-04-30T23:59:59.000Z')
    expect(fimDoPeriodo('2026-02-28').toISOString()).toBe('2026-03-28T23:59:59.000Z')
  })

  it('data do Asaas usa o fuso de Brasília', () => {
    expect(dataLocal(new Date('2026-10-10T01:00:00Z'))).toBe('2026-10-09')
    expect(dataLocal(new Date('2026-10-10T03:00:00Z'))).toBe('2026-10-10')
  })

  it('fim do teste atravessa mês e ano', () => {
    expect(dataLocal(somarDias(new Date('2026-12-25T15:00:00Z'), 14))).toBe('2027-01-08')
    expect(dataLocal(somarDias(new Date('2026-02-20T15:00:00Z'), 14))).toBe('2026-03-06')
  })

  it('status desconhecido não vira rótulo', () => {
    expect(statusLabel('xpto')).toBeNull()
    expect(statusLabel(undefined)).toBeNull()
  })

  it('plano sem dias de teste não dá teste', () => {
    expect(temDireitoAoTeste(null, false)).toBe(false)
    expect(temDireitoAoTeste(undefined, false)).toBe(false)
  })

  it('pro_plus legado e planos de outro tipo não são contratáveis', () => {
    for (const tipo of ['veterinario', 'clinica', 'prestador'] as const) {
      expect(planoServePara('pro_plus', tipo)).toBe(false)
    }
    expect(planoServePara('vet_pro', 'prestador')).toBe(false)
    expect(planoServePara('clinic_pro', 'veterinario')).toBe(false)
    expect(planoServePara('free', 'clinica')).toBe(false)
  })

  it('limite de vets da clínica', () => {
    expect(podeVincularVet(5, 0, false).ok).toBe(false)
    expect(podeVincularVet(5, 5, true).ok).toBe(false)
    expect(podeVincularVet(5, 4, true).ok).toBe(true)
    expect(podeVincularVet(null, 999, true).ok).toBe(true)
  })

  it('Média: o 15o vet entra, o 16o não', () => {
    expect(podeVincularVet(15, 14, true).ok).toBe(true)
    expect(podeVincularVet(15, 15, true)).toEqual({
      ok: false,
      motivo: 'Seu plano permite até 15 veterinários. Faça upgrade para vincular mais.',
    })
  })

  it('sem plano, a mensagem pede para assinar (mesmo com limite livre)', () => {
    expect(podeVincularVet(null, 0, false)).toEqual({
      ok: false,
      motivo: 'Assine um plano para vincular veterinários à clínica.',
    })
  })

  it('token do webhook é obrigatório em produção', () => {
    expect(webhookAutorizado(undefined, undefined, 'production')).toBe(false)
    expect(webhookAutorizado(undefined, undefined, 'sandbox')).toBe(true)
    expect(webhookAutorizado('t'.repeat(32), 'errado', 'sandbox')).toBe(false)
    expect(webhookAutorizado('t'.repeat(32), 't'.repeat(32), 'production')).toBe(true)
  })

  it('com token configurado, header ausente é recusado', () => {
    expect(webhookAutorizado('t'.repeat(32), null, 'sandbox')).toBe(false)
    expect(webhookAutorizado('t'.repeat(32), undefined, 'production')).toBe(false)
    expect(webhookAutorizado('', undefined, 'production')).toBe(false)
  })
})
