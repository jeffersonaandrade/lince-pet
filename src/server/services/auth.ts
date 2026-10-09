import 'server-only'
import { randomBytes } from 'node:crypto'
import { prisma } from '../db'
import { HttpError } from '../http'
import { updating } from '../lucid'
import { generateToken, type UserType } from '../auth/jwt'
import { hashPassword, verifyPassword } from '../auth/password'
import type { CurrentUser } from '../auth/session'
import { sendMail, defaultFrom } from './mail'
import { forgotPasswordEmail } from '../emails/forgot_password'

const FORGOT_PASSWORD_MESSAGE = 'um link de recuperação foi enviado para sua caixa de Email.'
const INVALID_RESET_TOKEN = 'Token inválido ou expirado.'

export async function findEntityId(userId: string, userType: string): Promise<string | undefined> {
  const where = { where: { userId }, select: { id: true } }
  switch (userType) {
    case 'tutor':
      return (await prisma.tutor.findFirst(where))?.id
    case 'veterinario':
      return (await prisma.veterinario.findFirst(where))?.id
    case 'clinica':
      return (await prisma.clinica.findFirst(where))?.id
    case 'prestador':
      return (await prisma.prestador.findFirst(where))?.id
  }
  return undefined
}

export async function tokenFor(user: { id: string; nome: string; sobrenome: string | null; userType: string }) {
  return generateToken({
    id: user.id,
    nome: user.nome,
    sobrenome: user.sobrenome,
    userType: user.userType as UserType,
    entityId: await findEntityId(user.id, user.userType),
  })
}

/** Equivalente ao User.verifyCredentials do withAuthFinder (E_INVALID_CREDENTIALS). */
async function verifyCredentials(email: string, password: string) {
  const invalid = new HttpError(400, { status: 400, message: 'Invalid user credentials' })
  const user = await prisma.user.findFirst({
    where: { email: { equals: email, mode: 'insensitive' } },
    omit: { password: false },
  })
  if (!user) {
    await hashPassword(password)
    throw invalid
  }
  if (!(await verifyPassword(user.password, password))) throw invalid
  return user
}

export async function login(email: string, password: string) {
  const user = await verifyCredentials(email, password)
  const token = await tokenFor(user)
  return {
    message: 'Login realizado com sucesso',
    user: {
      id: user.id,
      email: user.email,
      userType: user.userType,
      nome: user.nome,
    },
    token,
  }
}

export function getUserProfile(user: CurrentUser) {
  const baseProfile = {
    id: user.id,
    email: user.email,
    userType: user.userType,
    nome: user.nome,
    sobrenome: user.sobrenome,
    celular: user.celular,
    cidade: user.cidade,
    estado: user.estado,
    createdAt: user.createdAt,
    fotoUrl: user.profilePic || null,
    googleCalendarAuthorized: !!user.googleCalendarAuthorized,
  }

  if (user.userType === 'tutor' && user.tutor) {
    return { ...baseProfile, cpf: user.tutor.cpf }
  }

  if (user.userType === 'veterinario' && user.veterinario) {
    const vet = user.veterinario
    return {
      ...baseProfile,
      cpf: vet.cpf,
      cnpj: vet.cnpj,
      crmv: vet.crmv,
      bio: vet.bio,
      fotoUrl: vet.fotoUrl || baseProfile.fotoUrl,
      atendePresencial: vet.atendePresencial,
      atendeOnline: vet.atendeOnline,
      atendeDomicilio: vet.atendeDomicilio,
      precoConsulta: vet.precoConsulta,
      creditos: vet.creditos ?? 0,
      onboardingComplete: vet.onboardingComplete,
      subscriptionPlanCode: vet.subscriptionPlanCode || null,
      monthlyAppointmentsUsed: vet.monthlyAppointmentsUsed || 0,
    }
  }

  if (user.userType === 'clinica' && user.clinica) {
    const clinica = user.clinica
    return {
      ...baseProfile,
      nomeClinica: clinica.nomeClinica,
      tipoClinica: clinica.tipoClinica,
      cnpj: clinica.cnpj,
      descricao: clinica.descricao,
      horariosFuncionamento: clinica.horariosFuncionamento,
      quantidadeVets: clinica.quantidadeVets,
      onboardingComplete: clinica.onboardingComplete,
      isVerified: clinica.isVerified,
      fotoUrl: clinica.fotoPerfil || baseProfile.fotoUrl,
    }
  }

  if (user.userType === 'prestador' && user.prestador) {
    const p = user.prestador
    return {
      ...baseProfile,
      cpf: p.cpf,
      cnpj: p.cnpj,
      bio: p.bio,
      fotoUrl: p.fotoUrl || baseProfile.fotoUrl,
      tipoServico: { slug: p.tipoServico.slug, nome: p.tipoServico.nome, modalidade: p.tipoServico.modalidade },
      onboardingComplete: p.onboardingComplete,
      onboardingStep: p.onboardingStep,
      subscriptionPlanCode: p.subscriptionPlanCode || null,
    }
  }

  return baseProfile
}

export async function forgotPassword(email: string) {
  const user = await prisma.user.findFirst({
    where: { email: { equals: email, mode: 'insensitive' } },
  })
  if (!user) return { message: FORGOT_PASSWORD_MESSAGE }

  const token = randomBytes(32).toString('hex')

  await prisma.passwordResetToken.deleteMany({ where: { userId: user.id } })
  const now = new Date()
  await prisma.passwordResetToken.create({
    data: { userId: user.id, token, expiresAt: new Date(now.getTime() + 60 * 60 * 1000), createdAt: now, updatedAt: now },
  })

  const url = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/reset-password?token=${token}`
  await sendMail({
    from: defaultFrom(),
    to: user.email,
    subject: 'Redefinição de Senha - Lince-Pet',
    html: forgotPasswordEmail({ url, nome: user.nome }),
  })

  return { message: FORGOT_PASSWORD_MESSAGE }
}

export async function resetPassword(token: string, newPassword: string) {
  const resetToken = await prisma.passwordResetToken.findUnique({ where: { token } })
  if (!resetToken) throw new Error(INVALID_RESET_TOKEN)

  if (resetToken.expiresAt < new Date()) {
    await prisma.passwordResetToken.delete({ where: { id: resetToken.id } })
    throw new Error(INVALID_RESET_TOKEN)
  }

  const user = resetToken.userId ? await prisma.user.findUnique({ where: { id: resetToken.userId } }) : null
  if (!user) throw new Error('Usuário não encontrado.')

  await prisma.user.update({
    where: { id: user.id },
    data: updating({ password: await hashPassword(newPassword) }),
  })
  await prisma.passwordResetToken.delete({ where: { id: resetToken.id } })

  return { message: 'Senha redefinida com sucesso!' }
}
