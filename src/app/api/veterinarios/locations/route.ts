import { ApiRequest, created, notFound, route, serverError } from '@/server/http'
import { requireUser } from '@/server/auth/session'
import { prisma } from '@/server/db'
import { creating } from '@/server/lucid'
import { enderecoWriteData, findVeterinarioByUser } from '@/server/services/veterinarios'
import type { Prisma } from '@prisma/client'

export const POST = route(async (req) => {
  const apiReq = await ApiRequest.from(req)
  const currentUser = await requireUser(apiReq, ['veterinario'])
  try {
    const veterinario = await findVeterinarioByUser(currentUser.id)
    if (!veterinario) {
      return notFound({ message: 'Veterinário não encontrado' })
    }

    const data = apiReq.only([
      'rua',
      'numero',
      'bairro',
      'cidade',
      'estado',
      'cep',
      'complemento',
      'precoConsulta',
      'aceitaEmergencia',
      'observacoes',
      'horariosDisponibilidade',
      'nomeClinica',
    ])

    const horariosDisponibilidade =
      data.horariosDisponibilidade && typeof data.horariosDisponibilidade === 'object'
        ? JSON.stringify(data.horariosDisponibilidade)
        : data.horariosDisponibilidade || '{}'

    // A resposta reflete os atributos do model recém-criado (valores JS, não os do banco).
    const newLocation = creating({
      veterinarioId: veterinario.id,
      rua: data.rua,
      numero: data.numero,
      bairro: data.bairro,
      cidade: data.cidade,
      estado: data.estado,
      cep: data.cep,
      complemento: data.complemento,
      precoConsulta: Number(data.precoConsulta || 0),
      aceitaEmergencia: !!data.aceitaEmergencia,
      observacoes: data.observacoes,
      horariosDisponibilidade,
      nomeClinica: data.nomeClinica,
      ativo: true,
      isPrimary: false,
    })

    await prisma.veterinarioEndereco.create({
      data: enderecoWriteData(newLocation) as Prisma.VeterinarioEnderecoUncheckedCreateInput,
    })

    return created({
      message: 'Nova localização adicionada com sucesso',
      endereco: newLocation,
    })
  } catch (error) {
    console.error('❌ [Add Location] Erro:', error)
    return serverError({ message: 'Erro ao adicionar localização' })
  }
})
