import { describe, expect, it } from 'vitest'
import { dadosDoFormularioPet, formularioDoPet, FORMULARIO_PET_VAZIO, petDaApi } from '@/lib/pets'

const valido = { nome: ' Luna ', especie: 'Canina', raca: ' ', idade: '3', porte: 'medio' }

describe('dadosDoFormularioPet', () => {
  it('monta o corpo da API com texto aparado e campos opcionais omitidos', () => {
    expect(dadosDoFormularioPet(valido)).toEqual({
      dados: { nome: 'Luna', especie: 'Canina', raca: undefined, idade: 3, porte: 'medio' },
    })
    expect(dadosDoFormularioPet({ ...valido, idade: '' })).toEqual({
      dados: { nome: 'Luna', especie: 'Canina', raca: undefined, idade: undefined, porte: 'medio' },
    })
  })

  it('idade 0 (filhote com menos de um ano) é válida', () => {
    expect(dadosDoFormularioPet({ ...valido, idade: '0' })).toMatchObject({ dados: { idade: 0 } })
  })

  it('valida na ordem: nome, espécie, idade e porte', () => {
    expect(dadosDoFormularioPet(FORMULARIO_PET_VAZIO)).toEqual({ erro: 'Informe o nome do pet' })
    expect(dadosDoFormularioPet({ ...valido, especie: ' ' })).toEqual({ erro: 'Informe a espécie' })
    for (const idade of ['41', '-1', '2.5', 'abc']) {
      expect(dadosDoFormularioPet({ ...valido, idade })).toEqual({ erro: 'Idade deve ser um número de 0 a 40' })
    }
    expect(dadosDoFormularioPet({ ...valido, porte: 'gigante' })).toEqual({ erro: 'Informe o porte do animal' })
  })
})

describe('formularioDoPet', () => {
  it('preenche o formulário de edição sem perder idade 0', () => {
    const pet = petDaApi({ id: 1, nome: 'Rex', especie: 'Canina', idade: 0, porte: 'grande' })
    expect(formularioDoPet(pet)).toEqual({ nome: 'Rex', especie: 'Canina', raca: '', idade: '0', porte: 'grande' })
  })
})

describe('petDaApi', () => {
  it('converte a resposta snake_case e aceita fotoUrl de respostas antigas', () => {
    expect(
      petDaApi({ id: 7, tutorId: 't1', nome: 'Mia', especie: 'Felina', raca: 'Persa', idade: '4', porte: 'pequeno', fotoUrl: 'https://x/p.png', created_at: '2026-01-01' })
    ).toEqual({
      id: '7',
      tutor_id: 't1',
      nome: 'Mia',
      especie: 'Felina',
      raca: 'Persa',
      idade: 4,
      porte: 'pequeno',
      foto_url: 'https://x/p.png',
      created_at: '2026-01-01',
      arquivado_em: null,
    })
  })

  it('valores fora do contrato viram null em vez de quebrar a tela', () => {
    const pet = petDaApi({ id: 'p', tutor_id: 't', nome: 'Bob', especie: 'Ave', raca: '  ', idade: 'velho', porte: 'Gigante', foto_url: '', created_at: 123 })
    expect(pet).toMatchObject({ raca: null, idade: null, porte: null, foto_url: null, created_at: undefined })
  })

  it('rejeita pet sem id ou que não é objeto', () => {
    expect(() => petDaApi(null)).toThrow(TypeError)
    expect(() => petDaApi('pet')).toThrow(TypeError)
    expect(() => petDaApi({ nome: 'Sem id' })).toThrow('Pet sem id')
  })
})
