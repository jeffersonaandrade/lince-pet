import 'server-only'
import { Prisma, type Veterinario } from '@prisma/client'
import type { Infer } from '@vinejs/vine/types'
import { prisma } from '../db'
import { HttpError } from '../http'
import { creating } from '../lucid'
import type { CurrentUser } from '../auth/session'
import type {
  step1Validator,
  step2Validator,
  step3Validator,
  step4Validator,
  step5Validator,
  step6Validator,
  step7Validator,
} from '../validators/onboarding'
import {
  findVeterinarios,
  saveVeterinario,
  serializeVeterinario,
  syncEspecialidadesVeterinario,
  syncPlanosVeterinario,
  toDateColumn,
} from './veterinarios'

type Result = { success: boolean; [key: string]: unknown }

const rowNotFound = () => new HttpError(404, { status: 404, message: 'Row not found' })

/** `user.veterinario` sem checagem de nulo, como no Adonis (TypeError -> 500). */
const vetOf = (user: CurrentUser) => user.veterinario as Veterinario

const nextStep = (vet: Veterinario, step: number) => Math.max(step, vet.onboardingStep ?? 0)

export async function listVeterinarios(user: CurrentUser) {
  const veterinarios = await findVeterinarios({ userId: user.id }, ['user'])
  return veterinarios.map(serializeVeterinario)
}

export function validatePreviousSteps(veterinario: Veterinario, currentStep: number): string[] {
  const errors: string[] = []

  if (currentStep >= 2) {
    if (!veterinario.crmv) errors.push('CRMV é obrigatório')
  }

  if (currentStep >= 3) {
    if (!veterinario.genero) errors.push('Gênero é obrigatório')
  }

  if (currentStep >= 5) {
    if (!veterinario.atendePresencial && !veterinario.atendeOnline) {
      errors.push('Selecione pelo menos um tipo de visita')
    }
  }

  if (currentStep >= 8) {
    if (!veterinario.bio) errors.push('Descrição sobre você é obrigatória')
  }

  return errors
}

// Step 1: CRMV Registration
export async function processStep1(user: CurrentUser, payload: Infer<typeof step1Validator>): Promise<Result> {
  const veterinario = vetOf(user)

  const duplicate = await prisma.veterinario.findFirst({
    where: { crmv: payload.crmv, NOT: { id: veterinario.id } },
    select: { id: true },
  })
  if (duplicate) {
    return { success: false, errors: ['CRMV já está em uso'], field: 'crmv' }
  }

  const step = nextStep(veterinario, 2)
  await saveVeterinario(veterinario, { crmv: payload.crmv, onboardingStep: step })
  return { success: true, currentStep: step, veterinarioId: veterinario.id }
}

// Step 2: Gender Selection
export async function processStep2(user: CurrentUser, payload: Infer<typeof step2Validator>): Promise<Result> {
  const veterinario = vetOf(user)

  const errors = validatePreviousSteps(veterinario, 2)
  if (errors.length) return { success: false, errors }

  const generoMap: Record<string, 'masculino' | 'feminino' | 'outro'> = {
    Masculino: 'masculino',
    Feminino: 'feminino',
    Outro: 'outro',
  }
  const step = nextStep(veterinario, 3)
  await saveVeterinario(veterinario, { genero: generoMap[payload.genero], onboardingStep: step })
  return { success: true, currentStep: step }
}

// Step 3: Specialities Selection
export async function processStep3(user: CurrentUser, payload: Infer<typeof step3Validator>): Promise<Result> {
  const veterinario = vetOf(user)

  const errors = validatePreviousSteps(veterinario, 3)
  if (errors.length) return { success: false, errors }

  await syncEspecialidadesVeterinario(veterinario.id, payload.especialidades)

  const step = nextStep(veterinario, 4)
  await saveVeterinario(veterinario, { onboardingStep: step })
  return { success: true, currentStep: step }
}

// Step 4: Visit Types and Locations with Availability
export async function processStep4(user: CurrentUser, payload: Infer<typeof step4Validator>): Promise<Result> {
  const veterinario = vetOf(user)

  const errors = validatePreviousSteps(veterinario, 4)
  if (errors.length) return { success: false, errors }

  const { visitTypes, locations, precoConsultaOnline } = payload
  const validationErrors: string[] = []

  if (!visitTypes.presencial && !visitTypes.online) {
    validationErrors.push('Selecione pelo menos um tipo de visita (presencial ou online)')
  }

  if (visitTypes.presencial && (!locations || locations.length === 0)) {
    validationErrors.push('Para atendimento presencial, é necessário cadastrar pelo menos um endereço')
  }

  if (visitTypes.presencial && locations && locations.length > 0) {
    for (const [idx, location] of locations.entries()) {
      if (location.precoConsulta === undefined || location.precoConsulta === null || Number(location.precoConsulta) <= 0) {
        validationErrors.push(`Informe um valor de consulta válido para o local #${idx + 1}`)
      }
      const horarios = (location.horariosDisponibilidade || {}) as Record<string, string[] | undefined>
      const dias = ['segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado', 'domingo']
      const possuiAlgumHorario = dias.some((d) => Array.isArray(horarios[d]) && horarios[d]!.length > 0)
      if (!possuiAlgumHorario) {
        validationErrors.push(`Defina pelo menos um horário de disponibilidade para o local #${idx + 1}`)
      }
    }
  }

  if (visitTypes.online) {
    if (precoConsultaOnline === undefined || Number(precoConsultaOnline) <= 0) {
      validationErrors.push('Informe o valor da consulta online')
    }
  }

  if (validationErrors.length > 0) return { success: false, errors: validationErrors }

  const step = nextStep(veterinario, 5)
  await prisma.$transaction(async (tx) => {
    await saveVeterinario(
      veterinario,
      {
        atendePresencial: Number(visitTypes.presencial),
        atendeOnline: Number(visitTypes.online),
        precoConsultaOnline: precoConsultaOnline
          ? Math.round(Number(precoConsultaOnline) * 100) / 100
          : veterinario.precoConsultaOnline,
        onboardingStep: step,
      },
      tx
    )

    await tx.veterinarioEndereco.deleteMany({ where: { veterinarioId: veterinario.id } })

    if (visitTypes.presencial && locations && locations.length > 0) {
      for (const [i, location] of locations.entries()) {
        const fotoUrl = (location as { fotoUrl?: string }).fotoUrl
        await tx.veterinarioEndereco.create({
          data: creating({
            veterinarioId: veterinario.id,
            rua: location.rua,
            numero: location.numero,
            bairro: location.bairro || null,
            complemento: location.complemento || null,
            cidade: location.cidade,
            estado: location.estado,
            cep: location.cep,
            horariosDisponibilidade: (location.horariosDisponibilidade as Prisma.InputJsonValue | undefined) || Prisma.DbNull,
            aceitaEmergencia: Number(location.aceitaEmergencia || false),
            observacoes: location.observacoes || null,
            isPrimary: Number(location.isPrimary || i === 0),
            precoConsulta: Math.round(Number(location.precoConsulta) * 100) / 100,
            fotoUrl: fotoUrl || null,
            ativo: 1,
          }),
        })
      }
    }
  })
  return { success: true, currentStep: step }
}

// Step 5: Experiencia Profissional
export async function processStep5(user: CurrentUser, payload: Infer<typeof step5Validator>): Promise<Result> {
  const veterinario = vetOf(user)

  const errors = validatePreviousSteps(veterinario, 5)
  if (errors.length) return { success: false, errors }

  const { experiencias } = payload

  const step = nextStep(veterinario, 6)
  await prisma.$transaction(async (tx) => {
    await tx.experienciaVeterinario.deleteMany({ where: { veterinarioId: veterinario.id } })

    if (experiencias && Array.isArray(experiencias)) {
      for (const exp of experiencias) {
        await tx.experienciaVeterinario.create({
          data: creating({
            veterinarioId: veterinario.id,
            local: exp.local,
            cargo: exp.cargo,
            dataInicio: toDateColumn(exp.dataInicio),
            dataFim: toDateColumn(exp.dataFim),
            descricao: exp.descricao,
            ativo: Number(exp.ativo ?? true),
          }),
        })
      }
    }

    await saveVeterinario(veterinario, { onboardingStep: step }, tx)
  })
  return { success: true, currentStep: step }
}

// Step 6: Planos de Saude
export async function processStep6(user: CurrentUser, payload: Infer<typeof step6Validator>): Promise<Result> {
  const veterinario = vetOf(user)

  const errors = validatePreviousSteps(veterinario, 6)
  if (errors.length) return { success: false, errors }

  const { planos } = payload
  if (planos && Array.isArray(planos)) {
    await syncPlanosVeterinario(veterinario.id, planos)
  }

  const step = nextStep(veterinario, 7)
  await saveVeterinario(veterinario, { onboardingStep: step })
  return { success: true, currentStep: step }
}

// Step 7: Bio/About
export async function processStep7(user: CurrentUser, payload: Infer<typeof step7Validator>): Promise<Result> {
  const veterinario = vetOf(user)

  const errors = validatePreviousSteps(veterinario, 7)
  if (errors.length) return { success: false, errors }

  const step = nextStep(veterinario, 8)
  await saveVeterinario(veterinario, { bio: payload.about, onboardingStep: step })
  return { success: true, currentStep: step }
}

export async function completeOnboarding(user: CurrentUser): Promise<Result> {
  const veterinario = vetOf(user)

  const errors = validatePreviousSteps(veterinario, 7)
  if (errors.length) return { success: false, errors }

  if (!veterinario.bio) {
    return { success: false, errors: ['Descrição sobre você é obrigatória'] }
  }

  await saveVeterinario(veterinario, { onboardingComplete: 1 })
  return { success: true, message: 'Onboarding concluído com sucesso!' }
}

export async function getProgress(user: CurrentUser) {
  const [veterinario] = await findVeterinarios({ id: vetOf(user).id, userId: user.id }, [
    'user',
    'especialidades',
    'enderecos',
    'planos',
    'experiencias',
  ])
  if (!veterinario) throw rowNotFound()

  const currentStep = veterinario.onboardingStep
  const nextStepErrors = validatePreviousSteps(veterinario, (currentStep ?? 0) + 1)

  return {
    success: true,
    data: {
      veterinario: serializeVeterinario(veterinario),
      currentStep,
      canProceed: nextStepErrors.length === 0,
      nextStepRequirements: nextStepErrors,
    },
  }
}

export async function deleteVeterinario(user: CurrentUser) {
  const veterinario = await prisma.veterinario.findFirst({
    where: { id: vetOf(user).id, userId: user.id },
    select: { id: true },
  })
  if (!veterinario) throw rowNotFound()

  await prisma.veterinario.delete({ where: { id: veterinario.id } })
  return { success: true, message: 'Veterinário removido com sucesso' }
}
