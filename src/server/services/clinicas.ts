import { conferirNovosPlanosSaude } from './planos-saude'
import { normalizarPlanosClinicaInput } from '@/lib/planos-saude'
import 'server-only'
import { DateTime } from 'luxon'
import { Prisma, TipoClinica, UserType, type Clinica, type Especialidade, type User, type VeterinarioEndereco } from '@/generated/prisma/client'
import { prisma } from '../db'
import { serializeUser } from '../auth/session'
import { hashPassword } from '../auth/password'
import { creating, updating } from '../lucid'
import { PLANO_PADRAO } from './assinante'
import { conferirNovasEspecialidades } from './especialidades'
import { AREAS_DE_EXAMES, type PerfilAtendimento } from '@/lib/perfil-atendimento'
import { HttpError } from '../http'

/** Colunas que existem no banco mas não no model Lucid (não eram serializadas). */
export function serializeClinica<T extends Partial<Clinica>>(clinica: T) {
  const { nomeFantasia, ...rest } = clinica
  void nomeFantasia
  return rest
}

export function serializeEndereco<T extends Partial<VeterinarioEndereco>>(endereco: T) {
  const { horariosDisponibilidadeColuna, ...rest } = endereco
  void horariosDisponibilidadeColuna
  return rest
}

export const serializeRelatedUser = (user: Partial<User> | null | undefined) => (user ? serializeUser(user) : null)

/** Usuário exibido em página pública: só nome e foto (sem e-mail, celular ou endereço). */
export const usuarioPublico = (user: Partial<User> | null | undefined) =>
  user ? { id: user.id, nome: user.nome, sobrenome: user.sobrenome, profilePic: user.profilePic } : null

/** Veterinário exibido a terceiros: sem documentos (CPF/CNPJ, LGPD) nem dados internos de plano e créditos. */
const CAMPOS_PRIVADOS_VETERINARIO = new Set([
  'cpf', 'cnpj', 'creditos', 'subscriptionPlanCode', 'monthlyAppointmentsUsed', 'monthlyAppointmentsResetAt',
  'crmvMotivo', 'crmvEnviadoEm',
])

/** Clínica exibida a terceiros: a análise do RT (motivo da reprovação, data do envio) é só da clínica e do admin. */
export function clinicaPublica<T extends Partial<Clinica>>(clinica: T) {
  const { rtMotivo, rtEnviadoEm, ...rest } = serializeClinica(clinica)
  void rtMotivo
  void rtEnviadoEm
  return rest
}

export function veterinarioPublico<T extends Record<string, unknown>>(vet: T) {
  return Object.fromEntries(Object.entries(vet).filter(([k]) => !CAMPOS_PRIVADOS_VETERINARIO.has(k))) as Omit<
    T,
    | 'cpf'
    | 'cnpj'
    | 'creditos'
    | 'subscriptionPlanCode'
    | 'monthlyAppointmentsUsed'
    | 'monthlyAppointmentsResetAt'
    | 'crmvMotivo'
    | 'crmvEnviadoEm'
  >
}

/** Preload de `especialidades` (pivot polimórfica especialidade_relacionamentos). */
export async function especialidadesPorEntidade(ids: string[], tipo: 'clinica' | 'veterinario') {
  const map = new Map<string, Especialidade[]>()
  if (!ids.length) return map
  const rows = await prisma.especialidadeRelacionamento.findMany({
    where: { entidadeId: { in: ids }, entidadeTipo: tipo },
    include: { especialidade: true },
  })
  for (const row of rows) {
    const list = map.get(row.entidadeId) ?? []
    list.push(row.especialidade)
    map.set(row.entidadeId, list)
  }
  return map
}

export function mediaAvaliacoes(estrelas: (number | null)[]) {
  const totalReviews = estrelas.length
  let rating = 0
  if (totalReviews > 0) {
    const sum = estrelas.reduce<number>((acc, curr) => acc + Number(curr), 0)
    rating = Number.parseFloat((sum / totalReviews).toFixed(1))
  }
  return { rating, totalReviews }
}

/** String `YYYY-MM-DD HH:mm:ss.SSS` no fuso do processo, para comparar com `data_consulta` (VARCHAR). */
export function mysqlDateTime(d: Date) {
  const pad = (n: number, l = 2) => String(n).padStart(l, '0')
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ` +
    `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.${pad(d.getMilliseconds(), 3)}`
  )
}

/** `column.date` do Lucid consumia a string com DateTime.fromSQL; o controller fazia String(dt).split('T')[0]. */
export function formatDataConsulta(value: string | null) {
  if (value === null) return 'null'
  return String(DateTime.fromSQL(value)).split('T')[0]
}

/** O Lucid gravava JSON.stringify(...) em coluna JSON, que o MySQL armazenava como o valor parseado. */
export function toJsonColumn(value: unknown) {
  const parsed = typeof value === 'string' ? JSON.parse(value) : value
  return parsed === null ? Prisma.JsonNull : (parsed as Prisma.InputJsonValue)
}

export const str = (value: unknown) => (value === null || value === undefined ? (value as null | undefined) : String(value))

/** Equivalente a `model.save()` do Lucid: só grava (e atualiza updatedAt) se algo mudou. */
export function dirtyFields<T extends Record<string, unknown>>(current: Record<string, unknown>, changes: T) {
  return Object.fromEntries(Object.entries(changes).filter(([k, v]) => current[k] !== v)) as Partial<T>
}

export async function saveClinica(clinica: Clinica, changes: Prisma.ClinicaUpdateInput & Record<string, unknown>) {
  const dirty = dirtyFields(clinica as unknown as Record<string, unknown>, changes)
  if (!Object.keys(dirty).length) return
  await prisma.clinica.update({ where: { id: clinica.id }, data: updating(dirty) })
  Object.assign(clinica, dirty)
}

export async function saveUser(user: { id: string } & Record<string, unknown>, changes: Prisma.UserUpdateInput & Record<string, unknown>) {
  const dirty = dirtyFields(user, changes)
  if (!Object.keys(dirty).length) return
  await prisma.user.update({ where: { id: user.id }, data: updating(dirty) })
  Object.assign(user, dirty)
}

/** Equivalente ao `related(...).sync(ids)` do Lucid (sem timestamps na pivot). */
export async function syncEspecialidadesClinica(
  clinicaId: string,
  ids: unknown[],
  perfilAtual?: PerfilAtendimento | null,
  perfilEscolhido?: PerfilAtendimento,
) {
  const wanted = [...new Set(ids.map(String))]
  await prisma.$transaction(async (tx) => {
    if (perfilEscolhido && perfilEscolhido !== perfilAtual) {
      const { count } = await tx.clinica.updateMany({
        where: { id: clinicaId, OR: [{ perfilAtendimento: null }, { perfilAtendimento: perfilEscolhido }] },
        data: updating({ perfilAtendimento: perfilEscolhido }),
      })
      if (!count) throw new HttpError(409, { message: 'O tipo de estabelecimento já foi definido. Atualize a página.' })
    }
    if ((perfilEscolhido ?? perfilAtual) === 'exames' && wanted.length) {
      const count = await tx.especialidade.count({
        where: { id: { in: wanted }, nome: { in: [...AREAS_DE_EXAMES] } },
      })
      if (count !== wanted.length) {
        throw new HttpError(422, { message: 'Selecione somente áreas de exames veterinários.' })
      }
    }
    const existing = await tx.especialidadeRelacionamento.findMany({
      where: { entidadeId: clinicaId, entidadeTipo: 'clinica' },
    })
    const current = new Set(existing.map((r) => r.especialidadeId))
    const novas = wanted.filter((id) => !current.has(id))
    await conferirNovasEspecialidades(tx, novas)
    const remove = [...current].filter((id) => !wanted.includes(id))
    if (remove.length) {
      await tx.especialidadeRelacionamento.deleteMany({
        where: { entidadeId: clinicaId, entidadeTipo: 'clinica', especialidadeId: { in: remove } },
      })
    }
    const add = wanted.filter((id) => !current.has(id))
    if (add.length) {
      await tx.especialidadeRelacionamento.createMany({
        data: add.map((especialidadeId) => ({ entidadeId: clinicaId, especialidadeId, entidadeTipo: 'clinica' })),
      })
    }
  })
}

export async function syncPlanosClinica(clinicaId: string, planos: unknown) {
  const wanted = normalizarPlanosClinicaInput(planos)
  const wantedIds = wanted.map((p) => p.id)
  const categoriasPorId = new Map(wanted.map((p) => [p.id, p.categoriasAceitas]))
  await prisma.$transaction(async (tx) => {
    const existing = await tx.clinicaPlano.findMany({ where: { clinicaId } })
    const current = new Set(existing.map((r) => r.planoId))
    const add = wantedIds.filter((id) => !current.has(id))
    await conferirNovosPlanosSaude(tx, add)
    const remove = [...current].filter((id) => !wantedIds.includes(id))
    if (remove.length) await tx.clinicaPlano.deleteMany({ where: { clinicaId, planoId: { in: remove } } })
    if (add.length) {
      await tx.clinicaPlano.createMany({
        data: add.map((planoId) => ({
          clinicaId,
          planoId,
          categoriasAceitas: categoriasPorId.get(planoId) ?? null,
        })),
      })
    }
    const keep = wantedIds.filter((id) => current.has(id))
    for (const planoId of keep) {
      await tx.clinicaPlano.update({
        where: { clinicaId_planoId: { clinicaId, planoId } },
        data: { categoriasAceitas: categoriasPorId.get(planoId) ?? null },
      })
    }
  })
}

/** Plano da clínica para API (marca + categorias aceitas). */
export function planoClinicaPublico(cp: { categoriasAceitas?: string | null; plano: { id: string; name: string; ativo?: number | null; descricao?: string | null; image?: string | null } }) {
  return {
    ...cp.plano,
    categoriasAceitas: cp.categoriasAceitas?.trim() || null,
  }
}

export type ClinicaRegistrationData = {
  nomeFantasia?: string
  razaoSocial?: string
  cnpj: string
  telefone?: string
  celular?: string | null
  perfilAtendimento?: PerfilAtendimento
  email: string
  senha: string
  cep?: string
  rua?: string
  numero?: string
  bairro?: string
  cidade?: string
  estado?: string
}

const statusError = (message: string, status: number) => Object.assign(new Error(message), { status })

/** Equivalente ao ClinicaService.register. Devolve o `user` como o Lucid serializava após create + load('clinica'). */
export async function registerClinica(data: ClinicaRegistrationData) {
  const { normalizarCnpj } = await import('./cnpj')
  const cnpj = normalizarCnpj(data.cnpj)
  try {
    const password = await hashPassword(String(data.senha))
    const userData = creating({
      email: String(data.email).trim().toLowerCase(),
      password,
      userType: UserType.clinica,
      nome: str(data.nomeFantasia) as string,
      celular: data.perfilAtendimento ? data.celular ?? null : data.celular ?? str(data.telefone),
      cep: str(data.cep) || '',
      rua: str(data.rua) || '',
      numero: str(data.numero) || '',
      bairro: str(data.bairro) || '',
      cidade: str(data.cidade) || '',
      estado: str(data.estado) || '',
      ativo: 1,
    })

    const clinica = await prisma.$transaction(async (tx) => {
      await tx.user.create({ data: userData })
      return tx.clinica.create({
        data: creating({
          userId: userData.id,
          nomeClinica: str(data.nomeFantasia),
          razaoSocial: str(data.razaoSocial),
          tipoClinica: TipoClinica.multipla,
          perfilAtendimento: data.perfilAtendimento,
          quantidadeVets: '0',
          cnpj,
          telefone: str(data.telefone),
          endereco: data.rua ? `${data.rua}, ${data.numero} - ${data.bairro}` : '',
          cep: str(data.cep) || '',
          cidade: str(data.cidade) || '',
          estado: str(data.estado) || '',
          horariosFuncionamento: Prisma.DbNull,
          onboardingComplete: 0,
          isVerified: 0,
          subscriptionPlanCode: PLANO_PADRAO.clinica,
        }),
      })
    })

    const { password: _hidden, ...attrs } = userData
    void _hidden
    const user = { ...attrs, ativo: true, clinica: serializeClinica(clinica) }
    return { user, clinica }
  } catch (error) {
    console.error('[cadastro-clinica] operação recusada', { code: (error as { code?: string }).code || 'INTERNAL' })
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      const target = `${JSON.stringify(error.meta?.target ?? '')} ${error.message}`
      if (target.includes('email')) throw statusError('Email já está em uso', 422)
      if (target.includes('cnpj')) throw statusError('CNPJ já está em uso', 422)
      throw statusError('Dados duplicados encontrados', 422)
    }
    throw new Error('Erro ao registrar clínica')
  }
}
