import 'server-only'
import { prisma } from '../db'
import { HttpError } from '../http'
import { creating, updating } from '../lucid'
import type { CurrentUser } from '../auth/session'
import { inAppNotifications } from './in-app-notifications'

const rowNotFound = () => new HttpError(404, { status: 404, message: 'Row not found' })

const nomeVeterinario = (user: CurrentUser) => `${user.nome} ${user.sobrenome ?? ''}`.trim()

async function veterinarioDoUsuario(userId: string) {
  const vet = await prisma.veterinario.findFirst({ where: { userId } })
  if (!vet) throw rowNotFound()
  return vet
}

/** Retorna false quando não há solicitação pendente. */
export async function aceitarVinculo(currentUser: CurrentUser, clinicaId: string) {
  const vet = await veterinarioDoUsuario(currentUser.id)
  const where = { veterinarioId: vet.id, clinicaId }

  const pivot = await prisma.veterinarioClinica.findFirst({ where: { ...where, status: 'pendente' } })
  if (!pivot) return false

  await prisma.$transaction(async (tx) => {
    await tx.veterinarioClinica.updateMany({
      where,
      data: { status: 'aceito', ativo: 1, updatedAt: new Date() },
    })

    const clinica = await prisma.clinica.findUnique({ where: { id: clinicaId } })
    if (!clinica) throw rowNotFound()

    await tx.veterinarioEndereco.create({
      data: creating({
        veterinarioId: vet.id,
        clinicaId: clinica.id,
        nomeClinica: clinica.nomeClinica,
        rua: clinica.endereco || '',
        numero: 'S/N',
        bairro: '',
        cidade: clinica.cidade || '',
        estado: clinica.estado || '',
        cep: clinica.cep || '',
        precoConsulta: 0,
        horariosDisponibilidade: {},
        aceitaEmergencia: 0,
        ativo: 1,
        isPrimary: 0,
        fotoUrl: clinica.fotoPerfil,
      }),
    })

    const userClinica = clinica.userId ? await prisma.user.findFirst({ where: { id: clinica.userId } }) : null
    if (userClinica) {
      await inAppNotifications.notifyClinicLinkResponse({
        clinicaUserId: userClinica.id,
        veterinarioNome: nomeVeterinario(currentUser),
        aceito: true,
      })
    }
  })
  return true
}

/** Retorna false quando não há vínculo (em qualquer status). */
export async function recusarVinculo(currentUser: CurrentUser, clinicaId: string) {
  const vet = await veterinarioDoUsuario(currentUser.id)
  const where = { veterinarioId: vet.id, clinicaId }

  const pivot = await prisma.veterinarioClinica.findFirst({ where })
  if (!pivot) return false

  await prisma.veterinarioClinica.deleteMany({ where })

  const clinica = await prisma.clinica.findUnique({ where: { id: clinicaId } })
  if (!clinica) throw rowNotFound()

  const userClinica = clinica.userId ? await prisma.user.findFirst({ where: { id: clinica.userId } }) : null
  if (userClinica) {
    await inAppNotifications.notifyClinicLinkResponse({
      clinicaUserId: userClinica.id,
      veterinarioNome: nomeVeterinario(currentUser),
      aceito: false,
    })
  }
  return true
}
