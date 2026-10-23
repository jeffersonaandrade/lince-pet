import { describe, it, expect } from 'vitest'
import {
  blocosAbertos,
  cabeNoExpediente,
  clinicaVisivelNosExames,
  exameLotado,
  inicioDoBloco,
  motivoComboInvalido,
  paraHHmm,
  totaisDoPedido,
} from '@/server/services/exames-regras'
import { LIMITE_EXAMES_MES, planoComExames, podeAgendarExame } from '@/server/services/assinatura-regras'

const SEGUNDA = 1
const DOMINGO = 7

describe('blocosAbertos (horário da clínica)', () => {
  it('lista de inícios de slot: arredonda para o bloco de 30 min', () => {
    const abertos = blocosAbertos({ segunda: ['08:00', '08:30', '09:10'] }, SEGUNDA)
    expect([...abertos].sort((a, b) => a - b)).toEqual([480, 510, 540])
  })

  it('faixa em texto "08:00-10:00" vira blocos até o fim (exclusivo)', () => {
    expect([...blocosAbertos({ 'Segunda-feira': '08:00-10:00' }, SEGUNDA)]).toEqual([480, 510, 540, 570])
  })

  it('aceita JSON em string, acento e domingo', () => {
    expect(blocosAbertos(JSON.stringify({ Domingo: ['10:00'] }), DOMINGO).has(600)).toBe(true)
  })

  it('"Fechado", outro dia, JSON inválido, array ou nulo: nada aberto', () => {
    expect(blocosAbertos({ segunda: 'Fechado' }, SEGUNDA).size).toBe(0)
    expect(blocosAbertos({ terca: ['08:00'] }, SEGUNDA).size).toBe(0)
    expect(blocosAbertos('{quebrado', SEGUNDA).size).toBe(0)
    expect(blocosAbertos(['08:00'], SEGUNDA).size).toBe(0)
    expect(blocosAbertos(null, SEGUNDA).size).toBe(0)
    expect(blocosAbertos({ segunda: [8, 'x', '08:00'] }, SEGUNDA).size).toBe(1)
  })
})

describe('cabeNoExpediente', () => {
  const abertos = new Set([480, 510, 540])
  it('o exame inteiro precisa caber em blocos seguidos', () => {
    expect(cabeNoExpediente(abertos, 480, 90)).toBe(true)
    expect(cabeNoExpediente(abertos, 510, 90)).toBe(false)
  })
  it('início fora do passo ou duração zero não cabe', () => {
    expect(cabeNoExpediente(abertos, 490, 30)).toBe(false)
    expect(cabeNoExpediente(abertos, 480, 0)).toBe(false)
  })
})

describe('horas', () => {
  it('paraHHmm e inicioDoBloco são inversos; hora inválida vira null', () => {
    expect(paraHHmm(545)).toBe('09:05')
    expect(inicioDoBloco('09:05')).toBe(545)
    expect(inicioDoBloco('9h')).toBeNull()
  })
})

describe('exameLotado (capacidade por exame)', () => {
  const janela = { inicio: new Date('2026-11-02T12:00:00Z'), fim: new Date('2026-11-02T12:30:00Z') }
  const ocupa = (exameIds: string[], ini = '12:00', fim = '12:30') => ({
    inicio: new Date(`2026-11-02T${ini}:00Z`),
    fim: new Date(`2026-11-02T${fim}:00Z`),
    exameIds,
  })

  it('com vaga: null', () => {
    expect(exameLotado([{ id: 'e1', nome: 'Hemograma', capacidade: 2 }], [ocupa(['e1'])], janela)).toBeNull()
  })

  it('capacidade cheia: devolve o nome do exame lotado', () => {
    const pedidos = [
      { id: 'e2', nome: 'Raio-X', capacidade: 1 },
      { id: 'e1', nome: 'Hemograma', capacidade: 2 },
    ]
    expect(exameLotado(pedidos, [ocupa(['e1']), ocupa(['e1', 'e3'])], janela)).toBe('Hemograma')
  })

  it('ocupação que só encosta na janela não conta; capacidade 0 vale 1', () => {
    expect(exameLotado([{ id: 'e1', nome: 'H', capacidade: 0 }], [ocupa(['e1'], '11:30', '12:00')], janela)).toBeNull()
    expect(exameLotado([{ id: 'e1', nome: 'H', capacidade: 0 }], [ocupa(['e1'])], janela)).toBe('H')
  })
})

describe('combos', () => {
  const exames = [
    { id: 'a', clinicaId: 'c1', ativo: 1, nome: 'Hemograma', preco: '50.00', duracaoMin: 30 },
    { id: 'b', clinicaId: 'c1', ativo: 1, nome: 'Raio-X', preco: 120, duracaoMin: 60 },
    { id: 'x', clinicaId: 'c2', ativo: 1, nome: 'Outra', preco: 10, duracaoMin: 30 },
    { id: 'i', clinicaId: 'c1', ativo: 0, nome: 'Inativo', preco: 10, duracaoMin: 30 },
  ]

  it('precisa de 2 exames diferentes, ativos e da mesma clínica', () => {
    expect(motivoComboInvalido('c1', ['a', 'b'], exames)).toBeNull()
    expect(motivoComboInvalido('c1', ['a', 'a'], exames)).toMatch(/pelo menos 2/)
    expect(motivoComboInvalido('c1', ['a', 'x'], exames)).toMatch(/desta clínica/)
    expect(motivoComboInvalido('c1', ['a', 'zz'], exames)).toMatch(/desta clínica/)
    expect(motivoComboInvalido('c1', ['a', 'i'], exames)).toMatch(/Inativo.*inativo/)
  })

  it('preço: combo usa o preço do combo; avulso soma. Duração soma sempre', () => {
    expect(totaisDoPedido(exames.slice(0, 2))).toEqual({ duracaoMin: 90, preco: 170 })
    expect(totaisDoPedido(exames.slice(0, 2), '149.90')).toEqual({ duracaoMin: 90, preco: 149.9 })
  })
})

describe('visibilidade e plano', () => {
  it('só aparece com módulo ligado, RT aprovado e plano com exames', () => {
    expect(clinicaVisivelNosExames({ examesAtivo: 1, rtStatus: 'aprovado' }, true)).toBe(true)
    expect(clinicaVisivelNosExames({ examesAtivo: 1, rtStatus: 'pendente' }, true)).toBe(false)
    expect(clinicaVisivelNosExames({ examesAtivo: 0, rtStatus: 'aprovado' }, true)).toBe(false)
    expect(clinicaVisivelNosExames({ examesAtivo: 1, rtStatus: 'aprovado' }, false)).toBe(false)
  })

  it('só planos pagos de clínica têm o módulo', () => {
    expect(Object.keys(LIMITE_EXAMES_MES)).toEqual(['starter', 'clinic', 'clinic_pro'])
    expect(planoComExames('clinic')).toBe(true)
    expect(planoComExames('none')).toBe(false)
    expect(planoComExames(null)).toBe(false)
    expect(planoComExames('toString')).toBe(false)
  })

  it('limite mensal; inadimplente (plano none) não agenda novos', () => {
    expect(podeAgendarExame('starter', 99).ok).toBe(true)
    expect(podeAgendarExame('starter', 100)).toMatchObject({ ok: false, motivo: expect.stringMatching(/limite/) })
    expect(podeAgendarExame('clinic_pro', 10_000).ok).toBe(true)
    expect(podeAgendarExame('none', 0)).toMatchObject({ ok: false, motivo: expect.stringMatching(/não está recebendo/) })
  })
})
