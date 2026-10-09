import 'server-only'
import vine from '@vinejs/vine'

export const createEnderecoValidator = vine.compile(
  vine.object({
    endereco: vine.string().trim().minLength(5).maxLength(255),
    cidade: vine.string().trim().maxLength(100),
    estado: vine.string().trim().fixedLength(2),
    cep: vine
      .string()
      .trim()
      .regex(/^\d{5}-?\d{3}$/),
    horarios_funcionamento: vine.object({}).optional(),
  })
)

export const updateEnderecoValidator = vine.compile(
  vine.object({
    endereco: vine.string().trim().minLength(5).maxLength(255).optional(),
    cidade: vine.string().trim().maxLength(100).optional(),
    estado: vine.string().trim().fixedLength(2).optional(),
    cep: vine
      .string()
      .trim()
      .regex(/^\d{5}-?\d{3}$/)
      .optional(),
    horarios_funcionamento: vine.object({}).optional(),
    ativo: vine.boolean().optional(),
  })
)
