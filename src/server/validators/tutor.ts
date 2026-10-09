import 'server-only'
import vine from '@vinejs/vine'

export const createTutorValidator = vine.compile(
  vine.object({
    email: vine.string().trim().email(),
    password: vine.string().minLength(6).maxLength(255),
    nome: vine.string().trim().minLength(2).maxLength(100),
    genero: vine.enum(['masculino', 'feminino', 'outro']).optional(),
  })
)
