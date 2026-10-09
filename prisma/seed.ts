import { PrismaClient } from '@prisma/client'
import { randomUUID } from 'node:crypto'
import { especialidadesVeterinarias } from '../src/data/especialidades'
import { DIFERENCIAIS, PLANOS_ASSINATURA, PLANOS_SAUDE, TIPOS_SERVICO } from './catalogo'
import { seedDemonstracao } from './demo'

const prisma = new PrismaClient()

function agora() {
  const date = new Date()
  date.setMilliseconds(0)
  return date
}

async function seedPlanosAssinatura() {
  for (const plan of PLANOS_ASSINATURA) {
    const agoraUpdate = agora()
    await prisma.subscriptionPlan.upsert({
      where: { code: plan.code },
      create: {
        id: randomUUID(),
        code: plan.code,
        name: plan.name,
        targetType: plan.targetType,
        priceCents: plan.priceCents,
        currency: plan.currency,
        cycle: plan.cycle,
        monthlyAppointmentLimit: plan.monthlyAppointmentLimit,
        features: plan.features,
        searchPriority: plan.searchPriority,
        trialDays: plan.trialDays,
        active: plan.active,
        maxVeterinarios: plan.maxVeterinarios,
        createdAt: agoraUpdate,
        updatedAt: agoraUpdate,
      },
      update: {
        name: plan.name,
        targetType: plan.targetType,
        priceCents: plan.priceCents,
        currency: plan.currency,
        cycle: plan.cycle,
        monthlyAppointmentLimit: plan.monthlyAppointmentLimit,
        features: plan.features,
        searchPriority: plan.searchPriority,
        trialDays: plan.trialDays,
        active: plan.active,
        maxVeterinarios: plan.maxVeterinarios,
        updatedAt: agoraUpdate,
      },
    })
  }
}

async function seedEspecialidades() {
  const agoraCreate = agora()
  for (const nome of especialidadesVeterinarias) {
    await prisma.especialidade.upsert({
      where: { nome },
      create: {
        id: randomUUID(),
        nome,
        descricao: null,
        ativo: 1,
        createdAt: agoraCreate,
        updatedAt: agoraCreate,
      },
      update: {},
    })
  }
}

async function seedPlanosSaude() {
  const agoraCreate = agora()
  for (const name of PLANOS_SAUDE) {
    const existing = await prisma.plano.findFirst({ where: { name } })
    if (existing) continue
    await prisma.plano.create({
      data: {
        id: randomUUID(),
        name,
        image: null,
        createdAt: agoraCreate,
        updatedAt: agoraCreate,
      },
    })
  }
}

async function seedDiferenciais() {
  const agoraCreate = agora()
  for (const item of DIFERENCIAIS) {
    await prisma.diferencial.upsert({
      where: { nome: item.nome },
      create: {
        id: randomUUID(),
        nome: item.nome,
        descricao: item.descricao,
        icone: null,
        ativo: 1,
        createdAt: agoraCreate,
        updatedAt: agoraCreate,
      },
      update: {},
    })
  }
}

async function seedTiposServico() {
  const quando = agora()
  for (const tipo of TIPOS_SERVICO) {
    const dados = { nome: tipo.nome, descricao: tipo.descricao, modalidade: tipo.modalidade, ordem: tipo.ordem }
    await prisma.tipoServico.upsert({
      where: { slug: tipo.slug },
      create: { id: randomUUID(), slug: tipo.slug, ativo: 1, ...dados, createdAt: quando, updatedAt: quando },
      update: { ...dados, updatedAt: quando },
    })
  }
}

async function main() {
  await seedPlanosAssinatura()
  await seedEspecialidades()
  await seedPlanosSaude()
  await seedDiferenciais()
  await seedTiposServico()
  await seedDemonstracao(prisma)
  const [planos, especialidades, saude, diferenciais] = await Promise.all([
    prisma.subscriptionPlan.count(),
    prisma.especialidade.count({ where: { nome: { in: [...especialidadesVeterinarias] } } }),
    prisma.plano.count({ where: { name: { in: [...PLANOS_SAUDE] } } }),
    prisma.diferencial.count({ where: { nome: { in: DIFERENCIAIS.map((item) => item.nome) } } }),
  ])
  console.log(
    `Seed ok: ${planos} planos de assinatura, ${especialidades} especialidades da lista oficial, ${saude} planos de saúde, ${diferenciais} diferenciais.`
  )
}

main()
  .catch((error: unknown) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
