import 'server-only'
import vine from '@vinejs/vine'
import { prisma } from '../db'

export const createVeterinarioRegistrationValidator = vine.compile(
  vine.object({
    email: vine.string().trim().email(),
    password: vine.string().minLength(6).maxLength(255),
    nome: vine.string().trim().minLength(2).maxLength(100),
    sobrenome: vine.string().trim().minLength(2).maxLength(100),
    celular: vine.string().trim().minLength(10).maxLength(15),
    cpf: vine
      .string()
      .trim()
      .regex(/^\d{3}\.?\d{3}\.?\d{3}-?\d{2}$/)
      .optional(),
  })
)

const uniqueEmailExceptParam = vine.createRule(
  async (value, _options, field) => {
    if (typeof value !== 'string') return
    const params = (field.data as { params?: { id?: string } }).params
    const user = await prisma.user.findFirst({
      where: { email: value, ...(params?.id ? { NOT: { id: params.id } } : {}) },
      select: { id: true },
    })
    if (user) field.report('The {{ field }} has already been taken', 'database.unique', field)
  },
  { isAsync: true }
)

export const updateUserValidator = vine.compile(
  vine.object({
    name: vine.string().trim().minLength(2).maxLength(255).optional(),
    email: vine.string().trim().email().use(uniqueEmailExceptParam()).optional(),
    password: vine.string().minLength(6).maxLength(255).optional(),
  })
)
