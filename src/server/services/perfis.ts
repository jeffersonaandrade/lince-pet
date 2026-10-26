import 'server-only'
import { prisma } from '../db'
import { creating, updating } from '../lucid'
import { HttpError } from '../http'
import { loadUser } from '../auth/session'
import { tokenFor } from './auth'
import type { UserType } from '../auth/jwt'

export const PERFIS_INDIVIDUAIS = ['tutor', 'veterinario', 'prestador'] as const
const erro = (status: number, message: string) => new HttpError(status, { message })
export function tipoDePerfil(value: unknown): typeof PERFIS_INDIVIDUAIS[number] {
  if (!PERFIS_INDIVIDUAIS.includes(value as never)) throw erro(422, 'Escolha tutor, veterinário ou prestador.')
  return value as typeof PERFIS_INDIVIDUAIS[number]
}

export async function listarPerfis(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { userType: true } })
  if (!user) throw erro(401, 'Conta não encontrada.')
  if (user.userType === 'clinica') return [{ tipo: 'clinica', ativo: true }]
  const where = { userId }
  const [tutor, veterinario, prestador] = await Promise.all([
    prisma.tutor.findFirst({ where, select: { id: true } }),
    prisma.veterinario.findFirst({ where, select: { id: true } }),
    prisma.prestador.findFirst({ where, select: { id: true } }),
  ])
  return PERFIS_INDIVIDUAIS.map((tipo, i) => ({ tipo, ativo: !![tutor, veterinario, prestador][i] }))
}

export async function ativarPerfil(userId: string, body: Record<string, unknown>) {
  const tipo = tipoDePerfil(body.tipo)
  return prisma.$transaction(async tx => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`perfis:${userId}`}, 0))`
    const user = await tx.user.findUnique({ where: { id: userId } })
    if (!user || user.userType === 'clinica') throw erro(403, 'Clínicas e laboratórios mantêm login separado.')
    const where = { userId }
    const existente = tipo === 'tutor' ? await tx.tutor.findFirst({ where }) : tipo === 'veterinario' ? await tx.veterinario.findFirst({ where }) : await tx.prestador.findFirst({ where })
    if (existente) return { tipo }
    let cpf: string | null = null
    if (tipo !== 'tutor') {
      cpf = typeof body.cpf === 'string' ? body.cpf.replace(/\D/g, '') : ''
      const celular = typeof body.celular === 'string' ? body.celular.replace(/\D/g, '') : ''
      const sobrenome = typeof body.sobrenome === 'string' ? body.sobrenome.trim() : ''
      if (!/^\d{11}$/.test(cpf) || celular.length < 10 || celular.length > 15 || sobrenome.length < 2 || sobrenome.length > 100) throw erro(422, 'Preencha CPF, sobrenome e celular para ativar um perfil profissional.')
      const outros = await Promise.all([tx.tutor.findFirst({ where }), tx.veterinario.findFirst({ where }), tx.prestador.findFirst({ where })])
      if (outros.some(p => p?.cpf && p.cpf.replace(/\D/g, '') !== cpf)) throw erro(422, 'O CPF deve corresponder aos outros perfis desta conta.')
      await tx.user.update({ where: { id: userId }, data: updating({ celular, sobrenome }) })
    }
    if (tipo === 'tutor') {
      if (!await tx.tutor.findFirst({ where })) await tx.tutor.create({ data: creating({ userId }) })
    } else if (tipo === 'veterinario') {
      if (!await tx.veterinario.findFirst({ where })) await tx.veterinario.create({ data: creating({
        userId, cpf, subscriptionPlanCode: 'none', crmvStatus: 'pendente', onboardingStep: 1, onboardingComplete: 0,
      }) })
    } else {
      if (await tx.prestador.findFirst({ where })) return { tipo }
      if (typeof body.tipo_servico !== 'string') throw erro(422, 'Selecione o tipo de serviço.')
      const servico = await tx.tipoServico.findFirst({ where: { slug: body.tipo_servico, ativo: 1 } })
      if (!servico) throw erro(422, 'Tipo de serviço inválido.')
      await tx.prestador.create({ data: creating({ userId, cpf, tipoServicoId: servico.id, subscriptionPlanCode: 'free', onboardingStep: 1, onboardingComplete: 0 }) })
    }
    return { tipo }
  })
}

export async function selecionarPerfil(userId: string, tipo: unknown) {
  const perfil: UserType = tipoDePerfil(tipo)
  const disponiveis = await listarPerfis(userId)
  if (!disponiveis.some(p => p.tipo === perfil && p.ativo)) throw erro(403, 'Ative este perfil antes de utilizá-lo.')
  const user = await loadUser(userId, perfil)
  if (!user) throw erro(403, 'Perfil indisponível.')
  return { user, token: await tokenFor(user) }
}
