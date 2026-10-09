import { prisma } from '@/server/db'
import { ApiRequest, ok, route, unauthorized } from '@/server/http'
import { requireUser } from '@/server/auth/session'
import { especialidadesPorEntidade, serializeClinica } from '@/server/services/clinicas'

export const GET = route(async (req) => {
  const currentUser = await requireUser(await ApiRequest.from(req))
  const clinica = currentUser.clinica
  if (!clinica) {
    return unauthorized({ message: 'Acesso negado' })
  }

  const especialidades = (await especialidadesPorEntidade([clinica.id], 'clinica')).get(clinica.id) ?? []
  const planos = (
    await prisma.clinicaPlano.findMany({ where: { clinicaId: clinica.id }, include: { plano: true } })
  ).map((cp) => cp.plano)

  const currentStep = clinica.onboardingComplete
    ? 6
    : planos.length > 0
      ? 5
      : clinica.descricao || clinica.fotoPerfil
        ? 5
        : clinica.horariosFuncionamento
          ? 4
          : clinica.comodidades
            ? 3
            : especialidades.length > 0
              ? 2
              : 1

  return ok({
    currentStep,
    clinica: { ...serializeClinica(clinica), especialidades, planos },
  })
})
