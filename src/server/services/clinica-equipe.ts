import 'server-only'
import { prisma } from '../db'
import { HttpError } from '../http'
import { PLANO_PADRAO } from './assinante'
import { podeVincularVet } from './assinatura-regras'

/**
 * Barra convite/aceite sem plano pago ou acima de `max_veterinarios` do plano.
 * Contam vínculos aceitos e pendentes; `exceto` tira da conta o vet que está aceitando o próprio convite.
 */
export async function garantirVagaNaEquipe(clinicaId: string, exceto?: string) {
  const clinica = await prisma.clinica.findUnique({ where: { id: clinicaId }, select: { subscriptionPlanCode: true } })
  const code = clinica?.subscriptionPlanCode
  const plano = code && code !== PLANO_PADRAO.clinica ? await prisma.subscriptionPlan.findUnique({ where: { code } }) : null
  const vinculados = await prisma.veterinarioClinica.count({
    where: {
      clinicaId,
      status: { in: ['aceito', 'pendente'] },
      ...(exceto ? { veterinarioId: { not: exceto } } : {}),
    },
  })
  const r = podeVincularVet(plano?.maxVeterinarios, vinculados, Boolean(plano))
  if (!r.ok) throw new HttpError(403, { status: 403, message: r.motivo })
}

/** Veterinários com vínculo aceito com a clínica. */
export async function listarEquipe(clinicaId: string) {
  const vinculos = await prisma.veterinarioClinica.findMany({
    where: { clinicaId, status: 'aceito' },
    include: { veterinario: { include: { user: true } } },
  })
  return vinculos.map((v) => v.veterinario)
}

/** Desfaz o vínculo; a conta e o histórico do veterinário permanecem. */
export async function removerDaEquipe(clinicaId: string, veterinarioId: string) {
  const { count } = await prisma.veterinarioClinica.deleteMany({ where: { clinicaId, veterinarioId } })
  if (!count) throw new HttpError(404, { status: 404, message: 'Veterinário não vinculado a esta clínica' })
}
