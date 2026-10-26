import { describe, expect, it } from 'vitest'
import { enderecoVisivelAoProfissional, textoDoBairro, textoLocal } from '@/lib/endereco-domicilio'

const visita = {
  tipoConsulta: 'domicilio',
  localNome: 'Domicílio do tutor',
  localEndereco: 'Rua A, 10, Centro, Recife, PE, 50000000',
  localBairro: 'Centro',
  status: 'pendente',
}

describe('endereço da visita em domicílio', () => {
  it('pendente mostra só o bairro e o aceite libera a rua', () => {
    expect(enderecoVisivelAoProfissional(visita)).toBe('Bairro Centro')
    expect(enderecoVisivelAoProfissional({ ...visita, status: 'confirmado' })).toBe(visita.localEndereco)
    expect(enderecoVisivelAoProfissional({ ...visita, status: 'em andamento' })).toBe(visita.localEndereco)
    expect(enderecoVisivelAoProfissional({ ...visita, status: 'realizado' })).toBe(visita.localEndereco)
    expect(enderecoVisivelAoProfissional({ ...visita, status: 'cancelado' })).toBe('Bairro Centro')
  })

  it('sem bairro gravado usa o do perfil do tutor e, se faltar, avisa', () => {
    expect(enderecoVisivelAoProfissional({ ...visita, localBairro: null, enderecoTutor: { bairro: 'Aldeota' } })).toBe('Bairro Aldeota')
    expect(enderecoVisivelAoProfissional({ ...visita, localBairro: '  ', enderecoTutor: {} })).toBe('Bairro não informado')
    expect(textoDoBairro(null)).toBe('Bairro não informado')
  })

  it('pedido de prestador no domicílio segue a mesma regra; local próprio não esconde o endereço', () => {
    const pedido = { ...visita, tipoConsulta: 'tosador' }
    expect(enderecoVisivelAoProfissional(pedido)).toBe('Bairro Centro')
    expect(enderecoVisivelAoProfissional({ ...pedido, status: 'confirmado' })).toBe(visita.localEndereco)
    expect(enderecoVisivelAoProfissional({
      tipoConsulta: 'tosador',
      localNome: 'Local do profissional',
      localEndereco: 'Rua B, 2',
      status: 'pendente',
    })).toBe('Rua B, 2')
  })

  it('aviso ao profissional pendente não leva a rua; o tutor recebe o endereço completo', () => {
    expect(textoLocal(visita, 'profissional')).toBe('Domicílio do tutor — Bairro Centro')
    expect(textoLocal(visita, 'profissional')).not.toContain('Rua A')
    expect(textoLocal({ ...visita, status: 'confirmado' }, 'profissional')).toContain('Rua A, 10')
    expect(textoLocal(visita, 'tutor')).toContain('Rua A, 10')
    expect(textoLocal({ localNome: 'Clínica', localEndereco: 'Rua C', tipoConsulta: 'presencial' }, 'profissional')).toBe('Clínica')
  })
})
