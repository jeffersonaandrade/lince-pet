import 'server-only'
import { prisma } from '../db'
import { HttpError } from '../http'

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
