import { describe, expect, it } from 'vitest'
import {
  comodidadesMarcadas,
  formatarPrecoConsulta,
  perfilDaClinica,
  type ClinicaDetalheApi,
} from '@/lib/clinica-perfil'

const base: ClinicaDetalheApi = { id: 'c1', nomeClinica: 'Clínica Sol' }
const semAvaliacoes = { media: 0, total: 0, avaliacoes: [] }

describe('comodidadesMarcadas', () => {
  it('lista só as marcadas, com o rótulo de exibição, de objeto ou JSON em texto', () => {
    expect(comodidadesMarcadas({ wifi: true, estacionamento: false, raiox: 1 })).toEqual([
      'Wi-Fi Gratuito',
      'Raio-X / Ultrassom',
    ])
    expect(comodidadesMarcadas('{"internacao":true}')).toEqual(['Internação'])
  })

  it('mantém a chave quando não há rótulo conhecido', () => {
    expect(comodidadesMarcadas({ banho_e_tosa: true })).toEqual(['banho_e_tosa'])
  })

  it('não inventa comodidades quando a clínica não informou ou o JSON é inválido', () => {
    for (const valor of [null, undefined, '', '{quebrado', '[]', ['wifi'], 42]) {
      expect(comodidadesMarcadas(valor)).toEqual([])
    }
  })
})

describe('perfilDaClinica', () => {
  it('sem telefone não mostra número falso nem link de WhatsApp', () => {
    const perfil = perfilDaClinica(base, semAvaliacoes)
    expect(perfil.phone).toBeNull()
    expect(perfil.whatsappLink).toBeNull()
    expect(perfil.amenities).toEqual([])
  })

  it('formata o telefone e gera o link do WhatsApp com DDI 55, preferindo o campo whatsapp', () => {
    const perfil = perfilDaClinica({ ...base, telefone: '1133334444', whatsapp: '(11) 98888-7777' }, semAvaliacoes)
    expect(perfil.phone).toBe('(11) 3333-4444')
    expect(perfil.whatsappLink).toBe('https://wa.me/5511988887777')
  })

  it('usa o whatsapp como telefone quando só ele existe', () => {
    const perfil = perfilDaClinica({ ...base, whatsapp: '11988887777' }, semAvaliacoes)
    expect(perfil.phone).toBe('(11) 98888-7777')
  })

  it('monta o endereço sem "undefined" quando faltam partes', () => {
    expect(perfilDaClinica(base, semAvaliacoes).address).toBe('')
    expect(perfilDaClinica({ ...base, endereco: 'Rua A, 10', cidade: 'Campinas', estado: 'SP' }, semAvaliacoes).address).toBe(
      'R. A, 10, Campinas - SP'
    )
    expect(perfilDaClinica({ ...base, cidade: 'Campinas' }, semAvaliacoes).address).toBe('Campinas')
  })

  it('usa descricao, depois sobre, depois o texto padrão', () => {
    expect(perfilDaClinica({ ...base, descricao: 'D', sobre: 'S' }, semAvaliacoes).description).toBe('D')
    expect(perfilDaClinica({ ...base, sobre: 'S' }, semAvaliacoes).description).toBe('S')
    expect(perfilDaClinica(base, semAvaliacoes).description).toMatch(/medicina veterinária/)
  })

  it('normaliza a grade da clínica e a do profissional', () => {
    const perfil = perfilDaClinica(
      {
        ...base,
        horariosFuncionamento: '{"Segunda-feira":["08:00"]}',
        veterinarios: [{ id: 'v1', enderecos: [{ horariosDisponibilidade: { 'Terça-feira': ['09:00'] } }] }],
      },
      semAvaliacoes
    )
    expect(perfil.horarios).toEqual({ segunda: ['08:00'] })
    expect(perfil.professionals[0].specificSchedule).toEqual({ terca: ['09:00'] })
  })

  it('preço do profissional segue a regra do POST /agendamentos com clinica_id', () => {
    const perfil = perfilDaClinica(
      {
        ...base,
        veterinarios: [
          { id: 'endereco', precoConsulta: '200.00', enderecos: [{ precoConsulta: '180.50' }] },
          { id: 'endereco-zero', precoConsulta: '200.00', enderecos: [{ precoConsulta: '0.00' }] },
          { id: 'sem-endereco', precoConsulta: 120, enderecos: [] },
          { id: 'sem-preco' },
        ],
      },
      semAvaliacoes
    )
    expect(perfil.professionals.map((p) => p.price)).toEqual([180.5, 0, 120, null])
  })

  it('mapeia profissionais com nome, foto do usuário e padrões', () => {
    const [comNome, semNome] = perfilDaClinica(
      {
        ...base,
        veterinarios: [
          { id: 'v1', user: { nome: 'Ana', sobrenome: null, profilePic: 'https://x/a.png' }, especialidades: [{ nome: 'Dermato' }], crmv: 'SP-1', rating: 4.5 },
          { id: 'v2' },
        ],
      },
      semAvaliacoes
    ).professionals
    expect(comNome).toMatchObject({ name: 'Ana', specialty: 'Dermato', crmv: 'SP-1', fotoUrl: 'https://x/a.png', rating: 4.5 })
    expect(semNome).toMatchObject({ name: 'Veterinário', specialty: 'Médico Veterinário', crmv: 'N/A', fotoUrl: null, rating: 0, specificSchedule: null })
  })

  it('mapeia avaliações sem inventar data e com tutor anônimo', () => {
    const perfil = perfilDaClinica(base, {
      media: 4.2,
      total: 2,
      avaliacoes: [
        { estrelasClinica: 5, comentarioClinica: 'Ótimo', data: '10/10/2026', tutor: { nome: 'Rui', sobrenome: 'Lima' } },
        { estrelasClinica: 3 },
      ],
    })
    expect(perfil.rating).toBe(4.2)
    expect(perfil.reviewCount).toBe(2)
    expect(perfil.reviews).toEqual([
      { rating: 5, date: '10/10/2026', userName: 'Rui Lima', comment: 'Ótimo' },
      { rating: 3, date: '', userName: 'Tutor anônimo', comment: '' },
    ])
  })
})

describe('formatarPrecoConsulta', () => {
  it('formata inteiros sem centavos e decimais com vírgula', () => {
    expect(formatarPrecoConsulta(150)).toBe('R$ 150')
    expect(formatarPrecoConsulta(149.9)).toBe('R$ 149,90')
    expect(formatarPrecoConsulta(0)).toBe('R$ 0')
  })

  it('sem preço configurado mostra "a combinar" em vez de um valor inventado', () => {
    expect(formatarPrecoConsulta(null)).toBe('Valor a combinar')
  })
})
