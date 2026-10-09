import 'server-only'
import vine from '@vinejs/vine'

export const createAvaliacaoValidator = vine.compile(
  vine.object({
    estrelas: vine.number().withoutDecimals().min(1).max(5),
    comentario: vine.string().trim().maxLength(1000).optional(),
    estrelasClinica: vine.number().withoutDecimals().min(1).max(5).optional(),
    comentarioClinica: vine.string().trim().maxLength(1000).optional(),
  })
)
