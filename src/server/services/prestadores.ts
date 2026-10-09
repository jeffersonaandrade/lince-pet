import 'server-only'
import vine from '@vinejs/vine'
import { Prisma, type Prestador, type ServicoOferecido, type TipoServico, type User } from '@prisma/client'
import { prisma } from '../db'
import { HttpError } from '../http'
import { creating, updating } from '../lucid'
import { hashPassword } from '../auth/password'
import { nomeCompleto } from './agendamentos'
import { canCreateAppointment } from './subscription'

/**
 * Prestador de serviço pet (tosador, passeador, adestrador, pet sitter...). Tipo de conta único
 * (`prestador`); o tipo de serviço vem do catálogo `tipos_servico`. Um prestador tem um tipo.
 * Sem CRMV, especialidade, prontuário ou anotação clínica.
 */

export const MODALIDADES = ['duracao', 'periodo'] as const
export type Modalidade = (typeof MODALIDADES)[number]

export const ULTIMO_PASSO_ONBOARDING = 3

const invalid = (message: string) => new HttpError(422, { status: 422, message })

/* --------------------------------- catálogo -------------------------------- */

export const listarTiposServico = () =>
  prisma.tipoServico.findMany({ where: { ativo: 1 }, orderBy: [{ ordem: 'asc' }, { nome: 'asc' }] })

export const serializeTipoServico = (t: TipoServico) => ({
  id: t.id,
  slug: t.slug,
  nome: t.nome,
  descricao: t.descricao,
  modalidade: t.modalidade as Modalidade,
})

/* --------------------------------- cadastro -------------------------------- */

const cpfRegex = /^\d{3}\.?\d{3}\.?\d{3}-?\d{2}$/
const cnpjRegex = /^\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}$/

export const registroValidator = vine.compile(
  vine.object({
    tipo_servico: vine.string().trim().maxLength(50),
    email: vine.string().trim().email(),
    password: vine.string().minLength(6).maxLength(255),
    nome: vine.string().trim().minLength(2).maxLength(100),
    sobrenome: vine.string().trim().minLength(2).maxLength(100),
    celular: vine.string().trim().minLength(10).maxLength(15),
    cpf: vine.string().trim().regex(cpfRegex).optional(),
    cnpj: vine.string().trim().regex(cnpjRegex).optional(),
  })
)

export type RegistroPrestador = Awaited<ReturnType<typeof registroValidator.validate>>

export async function registrarPrestador(data: RegistroPrestador) {
  const email = data.email.trim().toLowerCase()
  const tipo = await prisma.tipoServico.findFirst({ where: { slug: data.tipo_servico, ativo: 1 } })
  if (!tipo) throw invalid('Tipo de serviço inválido')
  if (await prisma.user.findFirst({ where: { email: { equals: email, mode: 'insensitive' } }, select: { id: true } })) {
    throw invalid('Email já está em uso')
  }

  const password = await hashPassword(data.password)
  try {
    return await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: creating({
          email,
          password,
          userType: 'prestador' as const,
          nome: data.nome,
          sobrenome: data.sobrenome,
          celular: data.celular,
          ativo: 1,
        }),
      })
      const prestador = await tx.prestador.create({
        data: creating({
          userId: user.id,
          tipoServicoId: tipo.id,
          cpf: data.cpf || null,
          cnpj: data.cnpj || null,
          onboardingStep: 1,
          onboardingComplete: 0,
          subscriptionPlanCode: 'free',
        }),
      })
      return { user, prestador }
    })
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw invalid('Email já está em uso')
    }
    throw error
  }
}

/* -------------------------------- onboarding ------------------------------- */

const horaRegex = /^([01]\d|2[0-3]):[0-5]\d$/

export const passo1Validator = vine.compile(
  vine.object({
    cep: vine.string().trim().regex(/^\d{5}-?\d{3}$/),
    rua: vine.string().trim().minLength(2).maxLength(255),
    numero: vine.string().trim().maxLength(10),
    bairro: vine.string().trim().maxLength(100).optional(),
    cidade: vine.string().trim().minLength(2).maxLength(100),
    estado: vine.string().trim().fixedLength(2),
    atende_domicilio: vine.boolean(),
    atende_local_proprio: vine.boolean(),
    raio_km: vine.number().withoutDecimals().min(1).max(200).optional().nullable(),
  })
)

const servicoSchema = vine.object({
  nome: vine.string().trim().minLength(2).maxLength(120),
  descricao: vine.string().trim().maxLength(255).optional().nullable(),
  preco: vine.number().min(0).max(100000),
  duracao_min: vine.number().withoutDecimals().min(15).max(720).optional().nullable(),
})

export const servicosValidator = vine.compile(
  vine.object({ servicos: vine.array(servicoSchema).minLength(1).maxLength(20) })
)

export const passo3Validator = vine.compile(
  vine.object({
    bio: vine.string().trim().minLength(20).maxLength(2000),
    /** { "1": ["08:00", "18:00"], ... } 0=domingo */
    horarios: vine.record(vine.array(vine.string().trim().regex(horaRegex)).fixedLength(2)),
  })
)

type ServicoInput = Awaited<ReturnType<typeof servicosValidator.validate>>['servicos'][number]

/** Grade semanal validada: só dias 0..6 com abertura antes do fechamento. */
export function normalizarHorarios(horarios: Record<string, string[]>) {
  const out: Record<string, [string, string]> = {}
  for (const [dia, faixa] of Object.entries(horarios)) {
    if (!/^[0-6]$/.test(dia)) throw invalid('Dia da semana inválido nos horários')
    const [abre, fecha] = faixa
    if (abre >= fecha) throw invalid('O horário de fechamento deve ser depois da abertura')
    out[dia] = [abre, fecha]
  }
  if (!Object.keys(out).length) throw invalid('Informe ao menos um dia de atendimento')
  return out
}

/** Duração é obrigatória na modalidade `duracao` e proibida na `periodo` (preço por diária). */
export function validarServicosDaModalidade(servicos: ServicoInput[], modalidade: Modalidade) {
  for (const s of servicos) {
    if (modalidade === 'duracao' && !s.duracao_min) throw invalid(`Informe a duração de "${s.nome}"`)
    if (modalidade === 'periodo' && s.duracao_min) throw invalid(`"${s.nome}" é cobrado por diária e não tem duração`)
  }
}

type PrestadorComTipo = Prestador & { tipoServico: TipoServico }

const avancar = (p: Prestador, passo: number) => Math.max(p.onboardingStep, passo + 1)

export async function salvarPasso1(p: PrestadorComTipo, body: unknown) {
  const d = await passo1Validator.validate(body)
  if (!d.atende_domicilio && !d.atende_local_proprio) {
    throw invalid('Escolha atender em domicílio, em local próprio ou os dois')
  }
  await prisma.$transaction([
    prisma.user.update({
      where: { id: p.userId },
      data: updating({
        cep: d.cep.replace(/\D/g, ''),
        rua: d.rua,
        numero: d.numero,
        bairro: d.bairro || null,
        cidade: d.cidade,
        estado: d.estado.toUpperCase(),
      }),
    }),
    prisma.prestador.update({
      where: { id: p.id },
      data: updating({
        atendeDomicilio: d.atende_domicilio ? 1 : 0,
        atendeLocalProprio: d.atende_local_proprio ? 1 : 0,
        raioKm: d.raio_km ?? null,
        onboardingStep: avancar(p, 1),
      }),
    }),
  ])
}

/** Substitui os serviços ativos. Os antigos ficam inativos (pedidos antigos continuam apontando para eles). */
export async function salvarServicos(p: PrestadorComTipo, body: unknown, passo?: number) {
  const { servicos } = await servicosValidator.validate(body)
  validarServicosDaModalidade(servicos, p.tipoServico.modalidade as Modalidade)
  await prisma.$transaction([
    prisma.servicoOferecido.updateMany({ where: { prestadorId: p.id, ativo: 1 }, data: updating({ ativo: 0 }) }),
    prisma.servicoOferecido.createMany({
      data: servicos.map((s) =>
        creating({
          prestadorId: p.id,
          nome: s.nome,
          descricao: s.descricao || null,
          preco: s.preco,
          duracaoMin: s.duracao_min ?? null,
          ativo: 1,
        })
      ),
    }),
    ...(passo ? [prisma.prestador.update({ where: { id: p.id }, data: updating({ onboardingStep: avancar(p, passo) }) })] : []),
  ])
}

export async function salvarPasso3(p: PrestadorComTipo, body: unknown, fotoUrl?: string | null) {
  const d = await passo3Validator.validate(body)
  const horarios = normalizarHorarios(d.horarios)
  const servicos = await prisma.servicoOferecido.count({ where: { prestadorId: p.id, ativo: 1 } })
  if (!servicos) throw invalid('Cadastre ao menos um serviço antes de concluir')
  const user = await prisma.user.findUnique({ where: { id: p.userId }, select: { cidade: true } })
  if (!user?.cidade) throw invalid('Preencha o endereço de atendimento antes de concluir')

  await prisma.prestador.update({
    where: { id: p.id },
    data: updating({
      bio: d.bio,
      horarios,
      ...(fotoUrl ? { fotoUrl } : {}),
      onboardingStep: ULTIMO_PASSO_ONBOARDING + 1,
      onboardingComplete: 1,
    }),
  })
}

/* ------------------------------ perfil público ----------------------------- */

const includePublico = {
  user: true,
  tipoServico: true,
  servicos: { where: { ativo: 1 }, orderBy: { preco: 'asc' } },
  avaliacoes: { select: { estrelas: true } },
} satisfies Prisma.PrestadorInclude

const buscarPublico = (where: Prisma.PrestadorWhereInput) =>
  prisma.prestador.findMany({ where, include: includePublico, orderBy: { createdAt: 'desc' } })

type PrestadorPublico = Awaited<ReturnType<typeof buscarPublico>>[number]

export const serializeServico = (s: ServicoOferecido) => ({
  id: s.id,
  nome: s.nome,
  descricao: s.descricao,
  preco: Number(s.preco),
  duracao_min: s.duracaoMin,
})

const mediaDe = (estrelas: number[]) =>
  estrelas.length ? Number((estrelas.reduce((a, b) => a + b, 0) / estrelas.length).toFixed(1)) : null

/** Dados públicos: sem CPF/CNPJ, e-mail, celular nem rua/número. */
export function serializePrestadorPublico(p: PrestadorPublico) {
  const user = p.user as User
  return {
    id: p.id,
    nome: nomeCompleto(user),
    foto_url: p.fotoUrl || user.profilePic || null,
    bio: p.bio,
    tipo_servico: serializeTipoServico(p.tipoServico),
    cidade: user.cidade,
    estado: user.estado,
    bairro: user.bairro,
    atende_domicilio: Boolean(p.atendeDomicilio),
    atende_local_proprio: Boolean(p.atendeLocalProprio),
    raio_km: p.raioKm,
    horarios: (p.horarios as Record<string, [string, string]> | null) || {},
    servicos: p.servicos.map(serializeServico),
    preco_a_partir: p.servicos.length ? Math.min(...p.servicos.map((s) => Number(s.preco))) : null,
    nota_media: mediaDe(p.avaliacoes.map((a) => a.estrelas)),
    total_avaliacoes: p.avaliacoes.length,
  }
}

export type FiltrosBusca = { tipo?: string; cidade?: string; estado?: string; search?: string }

/** Só aparece na busca quem concluiu o onboarding e tem conta ativa. */
export async function buscarPrestadores(filtros: FiltrosBusca) {
  const where: Prisma.PrestadorWhereInput = {
    onboardingComplete: 1,
    user: {
      ativo: 1,
      ...(filtros.cidade ? { cidade: { contains: filtros.cidade, mode: 'insensitive' } } : {}),
      ...(filtros.estado ? { estado: filtros.estado.toUpperCase() } : {}),
    },
    tipoServico: { ativo: 1, ...(filtros.tipo ? { slug: filtros.tipo } : {}) },
    ...(filtros.search
      ? {
          OR: [
            { bio: { contains: filtros.search, mode: 'insensitive' } },
            { user: { nome: { contains: filtros.search, mode: 'insensitive' } } },
            { user: { sobrenome: { contains: filtros.search, mode: 'insensitive' } } },
          ],
        }
      : {}),
  }
  const prestadores = await buscarPublico(where)
  return prestadores.map(serializePrestadorPublico)
}

export async function obterPrestadorPublico(id: string) {
  const p = await prisma.prestador.findFirst({
    where: { id, onboardingComplete: 1, user: { ativo: 1 } },
    include: includePublico,
  })
  if (!p) throw new HttpError(404, { message: 'Profissional não encontrado' })
  const limite = await canCreateAppointment(p, 'prestador')
  return { ...serializePrestadorPublico(p), limite_atingido: !limite.allowed }
}

/* --------------------------------- painel ---------------------------------- */

export async function perfilDoPrestador(p: PrestadorComTipo) {
  const [user, servicos] = await Promise.all([
    prisma.user.findUnique({ where: { id: p.userId } }),
    prisma.servicoOferecido.findMany({ where: { prestadorId: p.id, ativo: 1 }, orderBy: { preco: 'asc' } }),
  ])
  return {
    id: p.id,
    tipo_servico: serializeTipoServico(p.tipoServico),
    onboarding_step: p.onboardingStep,
    onboarding_complete: Boolean(p.onboardingComplete),
    cpf: p.cpf,
    cnpj: p.cnpj,
    bio: p.bio,
    foto_url: p.fotoUrl,
    atende_domicilio: Boolean(p.atendeDomicilio),
    atende_local_proprio: Boolean(p.atendeLocalProprio),
    raio_km: p.raioKm,
    horarios: (p.horarios as Record<string, [string, string]> | null) || {},
    subscription_plan_code: p.subscriptionPlanCode,
    endereco: {
      cep: user?.cep ?? null,
      rua: user?.rua ?? null,
      numero: user?.numero ?? null,
      bairro: user?.bairro ?? null,
      cidade: user?.cidade ?? null,
      estado: user?.estado ?? null,
    },
    servicos: servicos.map(serializeServico),
  }
}

export async function prestadorDoUsuario(userId: string) {
  const p = await prisma.prestador.findFirst({ where: { userId }, include: { tipoServico: true } })
  if (!p) throw new HttpError(404, { message: 'Prestador não encontrado' })
  return p
}
