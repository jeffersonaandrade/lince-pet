import 'server-only'
import vine from '@vinejs/vine'

export const createClinicaValidator = vine.compile(
  vine.object({
    email: vine.string().trim().email(),
    password: vine.string().minLength(6).maxLength(255),
    nome: vine.string().trim().minLength(2).maxLength(100),
    sobrenome: vine.string().trim().minLength(2).maxLength(100),
    celular: vine.string().trim().minLength(10).maxLength(15),
    cep: vine
      .string()
      .trim()
      .regex(/^\d{8}$/),
    rua: vine.string().trim().minLength(2).maxLength(255),
    numero: vine.string().trim().maxLength(10),
    bairro: vine.string().trim().minLength(2).maxLength(100),
    cidade: vine.string().trim().maxLength(100),
    estado: vine.string().trim().fixedLength(2),
    nomeClinica: vine.string().trim().minLength(2).maxLength(200).optional(),
    quantidadeVeterinarios: vine.enum(['1', '2-5', '6-10', '11-20', '20+']).optional(),
    cnpj: vine.string().trim().fixedLength(14).optional(),
    descricao: vine.string().trim().optional(),
  })
)
