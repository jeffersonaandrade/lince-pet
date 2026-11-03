import { ApiRequest, notFound, ok, route, serverError } from '@/server/http'
import { requireUser } from '@/server/auth/session'
import { prisma } from '@/server/db'
import { now, updating } from '@/server/lucid'
import {
  dirtyFields,
  enderecoWriteData,
  findVeterinarioByUser,
  serializeEndereco,
} from '@/server/services/veterinarios'

export const PUT = route<{ id: string }>(async (req, { id }) => {
  const apiReq = await ApiRequest.from(req)
  const currentUser = await requireUser(apiReq, ['veterinario'])
  try {
    const veterinario = await findVeterinarioByUser(currentUser.id)
    if (!veterinario) {
      return notFound({ message: 'Veterinário não encontrado' })
    }

    const endereco = await prisma.veterinarioEndereco.findFirst({
      where: { id, veterinarioId: veterinario.id },
    })
    if (!endereco) {
      return notFound({ message: 'Endereço não encontrado' })
    }

    const data: Record<string, unknown> = apiReq.only([
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
      'ativo',
      'nomeClinica',
      'isPrimary',
    ])

    if ('isPrimary' in data) {
      data.isPrimary = data.isPrimary ? 1 : 0
      if (data.isPrimary === 1) {
        await prisma.veterinarioEndereco.updateMany({
          where: { veterinarioId: veterinario.id, id: { not: endereco.id } },
          data: { isPrimary: 0, updatedAt: now() },
        })
      }
    }

    if (data.horariosDisponibilidade && typeof data.horariosDisponibilidade === 'object') {
      data.horariosDisponibilidade = JSON.stringify(data.horariosDisponibilidade)
    }

    if (data.precoConsulta !== undefined) {
      data.precoConsulta = Number(data.precoConsulta)
    }

    // Como no `merge()` + `save()` do Lucid, a resposta traz os valores JS mesclados.
    const merged: Record<string, unknown> = { ...serializeEndereco(endereco), ...data }
    const dirty = dirtyFields(endereco, data)
    if (Object.keys(dirty).length) {
      const saved = await prisma.veterinarioEndereco.update({
        where: { id: endereco.id },
        data: updating(enderecoWriteData(dirty)),
        select: { updatedAt: true },
      })
      merged.updatedAt = saved.updatedAt
    }

    return ok({ message: 'Localização atualizada com sucesso', endereco: merged })
  } catch (error) {
    console.error('❌ [Update Location] Erro:', error)
    return serverError({ message: 'Erro ao atualizar localização' })
  }
})
