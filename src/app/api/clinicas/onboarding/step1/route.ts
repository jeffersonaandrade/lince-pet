import { ApiRequest, badRequest, ok, route, unauthorized } from '@/server/http'
import { requireUser } from '@/server/auth/session'
import { syncEspecialidadesClinica } from '@/server/services/clinicas'
import { perfilAtendimentoValido } from '@/lib/perfil-atendimento'

export const POST = route(async (req) => {
  const request = await ApiRequest.from(req)
  const currentUser = await requireUser(request)
  if (!currentUser.clinica) {
    return unauthorized({ message: 'Acesso negado' })
  }

  const { especialidades, perfilAtendimento } = request.only(['especialidades', 'perfilAtendimento'])

  if (perfilAtendimento !== undefined && !perfilAtendimentoValido(perfilAtendimento)) {
    return badRequest({ message: 'Selecione um tipo de estabelecimento válido.' })
  }
  if (Array.isArray(especialidades)) {
    await syncEspecialidadesClinica(currentUser.clinica.id, especialidades, currentUser.clinica.perfilAtendimento, perfilAtendimento)
  }

  return ok({ message: 'Especialidades salvas com sucesso' })
})
