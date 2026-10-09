import 'server-only'
import { Prisma } from '@prisma/client'
import { prisma } from '../db'
import { HttpError } from '../http'
import { creating } from '../lucid'
import { hashPassword } from '../auth/password'

type TutorRegistrationData = {
  nome: string
  email: string
  password: string
  cidade?: string
}

export async function registerTutor(data: TutorRegistrationData) {
  const { nome, email, password, cidade } = data
  try {
    const hashed = await hashPassword(password)
    return await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: creating({
          email,
          password: hashed,
          userType: 'tutor',
          nome,
          celular: null,
          cep: null,
          cidade: cidade || null,
          estado: null,
          ativo: 1,
        }),
      })
      return tx.tutor.create({ data: creating({ userId: user.id, cpf: null }) })
    })
  } catch (error) {
    console.log(error)
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      const target = `${JSON.stringify(error.meta?.target ?? '')} ${error.message}`
      if (target.includes('email')) {
        throw new HttpError(422, { status: 422, message: 'Email já está em uso' })
      }
      throw new HttpError(422, { status: 422, message: 'Dados duplicados encontrados' })
    }
    throw new Error('Erro ao registrar tutor')
  }
}
