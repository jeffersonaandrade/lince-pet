import 'server-only'
import vine from '@vinejs/vine'

export const createPetValidator = vine.compile(
  vine.object({
    nome: vine.string().trim().minLength(1).maxLength(120),
    especie: vine.string().trim().minLength(1).maxLength(120),
    raca: vine.string().trim().maxLength(120).optional(),
    idade: vine.number().withoutDecimals().positive().optional(),
    porte: vine.enum(['pequeno', 'medio', 'grande']).optional(),
    foto_url: vine.string().trim().url().optional(),
  })
)

export const updatePetValidator = vine.compile(
  vine.object({
    nome: vine.string().trim().minLength(1).maxLength(120).optional(),
    especie: vine.string().trim().minLength(1).maxLength(120).optional(),
    raca: vine.string().trim().maxLength(120).optional(),
    idade: vine.number().withoutDecimals().positive().optional(),
    porte: vine.enum(['pequeno', 'medio', 'grande']).optional(),
    foto_url: vine.string().trim().url().optional(),
  })
)
