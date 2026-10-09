import 'server-only'
import vine from '@vinejs/vine'

// Step 1: CRMV Registration
export const step1Validator = vine.compile(
  vine.object({
    crmv: vine
      .string()
      .trim()
      .minLength(1)
      .maxLength(15)
      .regex(/^\d+-[A-Z]{2}$/),
  })
)

// Step 2: Gender Selection
export const step2Validator = vine.compile(
  vine.object({
    genero: vine.enum(['Masculino', 'Feminino', 'Outro']),
  })
)

// Step 3: Specialities Selection
export const step3Validator = vine.compile(
  vine.object({
    especialidades: vine.array(vine.string().uuid()).minLength(1),
  })
)

const horario = () => vine.array(vine.string().regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/)).optional()

// Step 4: Visit Types and Locations with Availability
export const step4Validator = vine.compile(
  vine.object({
    visitTypes: vine.object({
      presencial: vine.boolean(),
      online: vine.boolean(),
    }),
    precoConsultaOnline: vine.number().positive().optional(),
    locations: vine
      .array(
        vine.object({
          rua: vine.string().trim().minLength(1),
          numero: vine.string().trim().minLength(1),
          bairro: vine.string().trim().minLength(1).optional(),
          complemento: vine.string().trim().optional(),
          cidade: vine.string().trim().minLength(1),
          estado: vine.string().trim().minLength(2).maxLength(2),
          cep: vine.string().trim().minLength(8).maxLength(9),
          isPrimary: vine.boolean().optional(),
          aceitaEmergencia: vine.boolean().optional(),
          observacoes: vine.string().trim().maxLength(500).optional(),
          precoConsulta: vine.number().positive(),
          fotoUrl: vine.string().trim().maxLength(2048).optional(),
          horariosDisponibilidade: vine
            .object({
              segunda: horario(),
              terca: horario(),
              quarta: horario(),
              quinta: horario(),
              sexta: horario(),
              sabado: horario(),
              domingo: horario(),
            })
            .optional(),
        })
      )
      .optional(),
  })
)

// Step 5: Experience
export const step5Validator = vine.compile(
  vine.object({
    experiencias: vine
      .array(
        vine.object({
          local: vine.string().trim().minLength(1),
          cargo: vine.string().trim().minLength(1),
          dataInicio: vine.string().trim(),
          dataFim: vine.string().trim().optional(),
          descricao: vine.string().trim().optional(),
          ativo: vine.boolean().optional(),
        })
      )
      .optional(),
  })
)

// Step 6: Plans
export const step6Validator = vine.compile(
  vine.object({
    planos: vine.array(vine.string().uuid()).optional(),
  })
)

// Step 7: About/Bio
export const step7Validator = vine.compile(
  vine.object({
    about: vine.string().trim().minLength(1).maxLength(500),
  })
)
