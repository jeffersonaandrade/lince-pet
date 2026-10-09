import { ApiRequest, badRequest, notFound, ok, route, serverError } from '@/server/http'
import { requireUser } from '@/server/auth/session'
import { prisma } from '@/server/db'
import { updating } from '@/server/lucid'
import {
  dirtyFields,
  enderecoWriteData,
  findVeterinarioByUser,
  mergeEndereco,
  replaceExperiencias,
  saveUserNome,
  saveVeterinario,
  syncEspecialidadesVeterinario,
  syncPlanosVeterinario,
  toJsonColumn,
} from '@/server/services/veterinarios'

export const PUT = route(async (req) => {
  const apiReq = await ApiRequest.from(req)
  const currentUser = await requireUser(apiReq, ['veterinario'])
  try {
    const veterinario = await findVeterinarioByUser(currentUser.id)
    if (!veterinario) {
      return notFound({ message: 'Veterinário não encontrado' })
    }

    const { nome, bio, especialidades, endereco, atendeOnline, precoConsultaOnline, horariosOnline, experiencias, planos } =
      apiReq.only([
        'nome',
        'bio',
        'especialidades',
        'endereco',
        'atendeOnline',
        'precoConsultaOnline',
        'horariosOnline',
        'experiencias',
        'planos',
      ])

    if (nome !== undefined) {
      await saveUserNome(currentUser, nome)
    }

    const changes: Record<string, unknown> = {}
    if (bio !== undefined) changes.bio = bio
    if (atendeOnline !== undefined) changes.atendeOnline = Number(!!atendeOnline)
    if (precoConsultaOnline !== undefined) changes.precoConsultaOnline = Number(precoConsultaOnline)
    if (horariosOnline !== undefined) {
      try {
        changes.horariosOnline = toJsonColumn(horariosOnline)
      } catch (e) {
        console.error('❌ [Update Profile] JSON Parse Error:', e)
        return badRequest({ message: 'Formato inválido para horários online' })
      }
    }

    if (experiencias !== undefined) {
      await replaceExperiencias(veterinario.id, experiencias)
    }

    if (planos !== undefined && Array.isArray(planos)) {
      await syncPlanosVeterinario(veterinario.id, planos)
    }

    if (Object.keys(changes).length) {
      await saveVeterinario(veterinario, changes)
    }

    if (Array.isArray(especialidades)) {
      await syncEspecialidadesVeterinario(veterinario.id, especialidades)
    }

    if (endereco && typeof endereco === 'object') {
      const primaryAddress = await prisma.veterinarioEndereco.findFirst({
        where: { veterinarioId: veterinario.id, isPrimary: 1 },
      })

      if (primaryAddress) {
        const dirty = dirtyFields(primaryAddress, mergeEndereco(endereco))
        if (Object.keys(dirty).length) {
          await prisma.veterinarioEndereco.update({
            where: { id: primaryAddress.id },
            data: updating(enderecoWriteData(dirty)),
          })
        }
      }
    }

    return ok({ message: 'Perfil atualizado com sucesso' })
  } catch (error) {
    console.error('❌ [Update Profile] Erro:', error)
    return serverError({ message: 'Erro ao atualizar perfil' })
  }
})
