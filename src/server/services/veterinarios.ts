import 'server-only'
import { DateTime } from 'luxon'
import {
  Prisma,
  type Avaliacao,
  type Especialidade,
  type ExperienciaVeterinario,
  type Plano,
  type User,
  type Veterinario,
  type VeterinarioEndereco,
} from '@prisma/client'
import { prisma } from '../db'
import { serializeUser, type PublicUser } from '../auth/session'
import { hashPassword } from '../auth/password'
import { creating, updating } from '../lucid'
import { canCreateAppointment } from './subscription'
import { PLANO_PADRAO } from './assinante'

type Db = Prisma.TransactionClient | typeof prisma

export type Preload = 'user' | 'especialidades' | 'enderecos' | 'avaliacoes' | 'experiencias' | 'planos'

export type VeterinarioLoaded = Veterinario & {
  user?: PublicUser | null
  especialidades?: Especialidade[]
  enderecos?: VeterinarioEndereco[]
  avaliacoes?: Avaliacao[]
  experiencias?: ExperienciaVeterinario[]
  planos?: Plano[]
}

/* ------------------------------------------------------------------ */
/* Helpers de persistência/serialização (comportamento do Lucid)       */
/* ------------------------------------------------------------------ */

const statusError = (message: string, status: number) => Object.assign(new Error(message), { status })

export const findVeterinarioByUser = (userId: string) => prisma.veterinario.findFirst({ where: { userId } })

/** O Lucid gravava JSON.stringify(...) em coluna JSON; o MySQL armazenava o valor já parseado. */
export function toJsonColumn(value: unknown) {
  if (value === undefined) return undefined
  const parsed = typeof value === 'string' ? JSON.parse(value) : value
  return parsed === null ? Prisma.JsonNull : (parsed as Prisma.InputJsonValue)
}

/** Valor cru enviado a uma coluna JSON (null vira SQL NULL, string é parseada pelo MySQL). */
const rawJsonColumn = (value: unknown) => (value === null ? Prisma.DbNull : toJsonColumn(value))

/** Valor cru enviado a uma coluna tinyint(1). */
export const toTinyInt = (value: unknown) =>
  value === null || value === undefined ? (value as null | undefined) : Number(value)

/** DATE do Prisma vem em UTC; o mysql2 entregava meia-noite local, que o Lucid serializava em ISO. */
export const dateColumn = (value: Date | null) =>
  value
    ? DateTime.fromObject({ year: value.getUTCFullYear(), month: value.getUTCMonth() + 1, day: value.getUTCDate() })
    : null

export function toDateColumn(value: unknown): Date | null | undefined {
  if (value === undefined) return undefined
  if (value === null || value === '') return null
  if (value instanceof Date) return value
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value))
  if (match) return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])))
  const parsed = new Date(String(value))
  if (Number.isNaN(parsed.getTime())) throw new Error(`Invalid date value "${String(value)}"`)
  return new Date(Date.UTC(parsed.getFullYear(), parsed.getMonth(), parsed.getDate()))
}

export function serializeEndereco<T extends Partial<VeterinarioEndereco>>(endereco: T) {
  const { horariosDisponibilidadeColuna, ...rest } = endereco
  void horariosDisponibilidadeColuna
  return rest
}

export const serializeExperiencia = (exp: ExperienciaVeterinario) => ({
  ...exp,
  dataInicio: dateColumn(exp.dataInicio),
  dataFim: dateColumn(exp.dataFim),
})

/** Equivalente ao `model.serialize()` com os preloads carregados. */
export function serializeVeterinario(vet: VeterinarioLoaded) {
  const out: Record<string, unknown> = { ...vet }
  if ('user' in vet) out.user = vet.user ? serializeUser(vet.user as Partial<User>) : null
  if (vet.enderecos) out.enderecos = vet.enderecos.map(serializeEndereco)
  if (vet.experiencias) out.experiencias = vet.experiencias.map(serializeExperiencia)
  return out
}

/** `merge()` do Lucid: aceita propriedades ou nomes de coluna e falha com chaves desconhecidas. */
function lucidMerge(model: string, attributes: string[], columns: Record<string, string>, values: Record<string, unknown>) {
  const out: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(values)) {
    if (attributes.includes(key)) out[key] = value
    else if (columns[key]) out[columns[key]] = value
    else if (value !== undefined) {
      throw new Error(`Cannot define "${key}" on "${model}" model, since it is not defined as a model property`)
    }
  }
  return out
}

const TIMESTAMP_COLUMNS = { created_at: 'createdAt', updated_at: 'updatedAt' }

export const mergeEndereco = (values: Record<string, unknown>) =>
  lucidMerge(
    'VeterinarioEndereco',
    ['id', 'veterinarioId', 'rua', 'nomeClinica', 'numero', 'bairro', 'complemento', 'cidade', 'estado', 'cep',
      'horariosDisponibilidade', 'precoConsulta', 'aceitaEmergencia', 'observacoes', 'isPrimary', 'fotoUrl', 'ativo',
      'clinicaId', 'createdAt', 'updatedAt'],
    {
      veterinario_id: 'veterinarioId',
      nome_clinica: 'nomeClinica',
      horarios_funcionamento: 'horariosDisponibilidade',
      preco_consulta: 'precoConsulta',
      aceita_emergencia: 'aceitaEmergencia',
      is_primary: 'isPrimary',
      foto_url: 'fotoUrl',
      clinica_id: 'clinicaId',
      ...TIMESTAMP_COLUMNS,
    },
    values
  )

const mergeExperiencia = (values: Record<string, unknown>) =>
  lucidMerge(
    'ExperienciaVeterinario',
    ['id', 'veterinarioId', 'local', 'cargo', 'dataInicio', 'dataFim', 'descricao', 'ativo', 'createdAt', 'updatedAt'],
    { veterinario_id: 'veterinarioId', data_inicio: 'dataInicio', data_fim: 'dataFim', ...TIMESTAMP_COLUMNS },
    values
  )

/** Converte os atributos mesclados de um endereço para os tipos do Prisma. */
export function enderecoWriteData(attrs: Record<string, unknown>) {
  const data: Record<string, unknown> = { ...attrs }
  for (const key of ['aceitaEmergencia', 'isPrimary', 'ativo']) {
    if (key in data) data[key] = toTinyInt(data[key])
  }
  if ('horariosDisponibilidade' in data) data.horariosDisponibilidade = rawJsonColumn(data.horariosDisponibilidade)
  return data as Prisma.VeterinarioEnderecoUncheckedUpdateInput
}

/** Equivalente ao `model.save()`: só grava (e atualiza updatedAt) os campos alterados. */
export function dirtyFields(current: object, changes: Record<string, unknown>) {
  const row = current as Record<string, unknown>
  return Object.fromEntries(Object.entries(changes).filter(([k, v]) => row[k] !== v))
}

export async function saveVeterinario(vet: Veterinario, changes: Record<string, unknown>, db: Db = prisma) {
  const dirty = dirtyFields(vet, changes)
  if (!Object.keys(dirty).length) return
  await db.veterinario.update({ where: { id: vet.id }, data: updating(dirty) as Prisma.VeterinarioUncheckedUpdateInput })
  Object.assign(vet, dirty)
}

export async function saveUserNome(user: { id: string; nome: string }, nome: unknown) {
  if (user.nome === nome) return
  await prisma.user.update({ where: { id: user.id }, data: updating({ nome: nome as string }) })
  user.nome = nome as string
}

/** `related('especialidades').sync({ id: { entidade_tipo: 'veterinario' } })`. */
export async function syncEspecialidadesVeterinario(veterinarioId: string, ids: unknown[]) {
  const wanted = [...new Set(ids.map(String))]
  await prisma.$transaction(async (tx) => {
    const existing = await tx.especialidadeRelacionamento.findMany({
      where: { entidadeId: veterinarioId, entidadeTipo: 'veterinario' },
    })
    const current = new Set(existing.map((r) => r.especialidadeId))
    const remove = [...current].filter((id) => !wanted.includes(id))
    if (remove.length) {
      await tx.especialidadeRelacionamento.deleteMany({
        where: { entidadeId: veterinarioId, entidadeTipo: 'veterinario', especialidadeId: { in: remove } },
      })
    }
    const add = wanted.filter((id) => !current.has(id))
    if (add.length) {
      await tx.especialidadeRelacionamento.createMany({
        data: add.map((especialidadeId) => ({ entidadeId: veterinarioId, especialidadeId, entidadeTipo: 'veterinario' })),
      })
    }
  })
}

/** `related('planos').sync(ids)` (pivot sem timestamps). */
export async function syncPlanosVeterinario(veterinarioId: string, ids: unknown[]) {
  const wanted = [...new Set(ids.map(String))]
  await prisma.$transaction(async (tx) => {
    const existing = await tx.veterinarioPlano.findMany({ where: { veterinarioId } })
    const current = new Set(existing.map((r) => r.planoId))
    const remove = [...current].filter((id) => !wanted.includes(id))
    if (remove.length) await tx.veterinarioPlano.deleteMany({ where: { veterinarioId, planoId: { in: remove } } })
    const add = wanted.filter((id) => !current.has(id))
    if (add.length) await tx.veterinarioPlano.createMany({ data: add.map((planoId) => ({ veterinarioId, planoId })) })
  })
}

/** `related('experiencias').query().delete()` + `createMany(experiencias)`. */
export async function replaceExperiencias(veterinarioId: string, experiencias: unknown) {
  await prisma.experienciaVeterinario.deleteMany({ where: { veterinarioId } })
  if (!Array.isArray(experiencias) || experiencias.length === 0) return
  const rows = experiencias.map((exp) => {
    const attrs = mergeExperiencia((exp ?? {}) as Record<string, unknown>)
    return creating({
      veterinarioId,
      local: attrs.local as string,
      cargo: attrs.cargo as string,
      dataInicio: toDateColumn(attrs.dataInicio),
      dataFim: toDateColumn(attrs.dataFim),
      descricao: attrs.descricao as string | null | undefined,
      ativo: toTinyInt(attrs.ativo),
    })
  })
  await prisma.$transaction(rows.map((data) => prisma.experienciaVeterinario.create({ data })))
}

/** Endereço primário; senão, qualquer endereço ativo. */
export async function findEnderecoPrincipalOuAtivo(veterinarioId: string) {
  return (
    (await prisma.veterinarioEndereco.findFirst({ where: { veterinarioId, isPrimary: 1 } })) ??
    (await prisma.veterinarioEndereco.findFirst({ where: { veterinarioId, ativo: 1 } }))
  )
}

/* ------------------------------------------------------------------ */
/* Carregamento com preloads                                          */
/* ------------------------------------------------------------------ */

export async function findVeterinarios(where: Prisma.VeterinarioWhereInput, preloads: Preload[]) {
  const has = (p: Preload) => preloads.includes(p)
  const rows = await prisma.veterinario.findMany({
    where,
    include: {
      user: has('user'),
      enderecos: has('enderecos'),
      avaliacoes: has('avaliacoes'),
      experiencias: has('experiencias'),
      veterinarioPlanos: has('planos') ? { include: { plano: true } } : false,
    },
  })
  const especialidades = new Map<string, Especialidade[]>()
  if (has('especialidades') && rows.length) {
    const pivots = await prisma.especialidadeRelacionamento.findMany({
      where: { entidadeId: { in: rows.map((r) => r.id) }, entidadeTipo: 'veterinario' },
      include: { especialidade: true },
    })
    for (const pivot of pivots) {
      const list = especialidades.get(pivot.entidadeId) ?? []
      list.push(pivot.especialidade)
      especialidades.set(pivot.entidadeId, list)
    }
  }

  return rows.map((row) => {
    const { veterinarioPlanos, ...rest } = row as unknown as Veterinario & {
      veterinarioPlanos?: { plano: Plano }[]
    }
    const vet = rest as VeterinarioLoaded
    if (!has('user')) delete vet.user
    else vet.user = vet.user ?? null
    if (!has('enderecos')) delete vet.enderecos
    if (!has('avaliacoes')) delete vet.avaliacoes
    if (!has('experiencias')) delete vet.experiencias
    if (has('planos')) vet.planos = (veterinarioPlanos ?? []).map((vp) => vp.plano)
    if (has('especialidades')) vet.especialidades = especialidades.get(row.id) ?? []
    return vet
  })
}

/* ------------------------------------------------------------------ */
/* VeterinariosService                                                 */
/* ------------------------------------------------------------------ */

export type VeterinarioRegistrationData = {
  email: string
  password: string
  nome: string
  sobrenome: string
  celular: string
  cpf?: string
  profilePicUrl?: string
}

export async function registerVeterinario(data: VeterinarioRegistrationData) {
  try {
    const password = await hashPassword(data.password)
    await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: creating({
          email: data.email.trim().toLowerCase(),
          password,
          userType: 'veterinario',
          nome: data.nome,
          sobrenome: data.sobrenome,
          celular: data.celular,
          ativo: 1,
        }),
      })
      await tx.veterinario.create({
        data: creating({
          userId: user.id,
          cpf: data.cpf || null,
          crmv: null,
          onboardingStep: 1,
          onboardingComplete: 0,
          isVerified: 0,
          atendePresencial: 0,
          atendeOnline: 0,
          atendeDomicilio: 0,
          fotoUrl: data.profilePicUrl || null,
          subscriptionPlanCode: PLANO_PADRAO.veterinario,
        }),
      })
    })
  } catch (error) {
    console.log(error)
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      const target = `${JSON.stringify(error.meta?.target ?? '')} ${error.message}`
      if (target.includes('email')) throw statusError('Email já está em uso', 422)
    }
    throw new Error('Erro ao registrar veterinário')
  }
}

export type SearchFilters = {
  search?: string
  cidade?: string
  estado?: string
  especialidade?: string
  plano?: string
}

export async function searchVeterinarios(filters: SearchFilters) {
  const conds: Prisma.Sql[] = [Prisma.sql`TRUE`]
  if (filters.search) {
    const like = `%${filters.search}%`
    conds.push(Prisma.sql`(EXISTS (SELECT 1 FROM users u WHERE u.id = v.user_id AND CONCAT(u.nome, ' ', u.sobrenome) ILIKE ${like}) OR v.bio ILIKE ${like})`)
  }
  if (filters.cidade) {
    conds.push(Prisma.sql`EXISTS (SELECT 1 FROM veterinario_enderecos e WHERE e.veterinario_id = v.id AND e.cidade ILIKE ${`%${filters.cidade}%`})`)
  }
  if (filters.estado) {
    conds.push(Prisma.sql`EXISTS (SELECT 1 FROM veterinario_enderecos e WHERE e.veterinario_id = v.id AND e.estado = ${filters.estado})`)
  }
  if (filters.especialidade) {
    conds.push(Prisma.sql`EXISTS (SELECT 1 FROM especialidades es INNER JOIN especialidade_relacionamentos er ON er.especialidade_id = es.id WHERE er.entidade_id = v.id AND er.entidade_tipo = 'veterinario' AND es.nome ILIKE ${`%${filters.especialidade}%`})`)
  }
  if (filters.plano) {
    conds.push(Prisma.sql`EXISTS (SELECT 1 FROM planos p INNER JOIN veterinario_planos vp ON vp.plano_id = p.id WHERE vp.veterinario_id = v.id AND p.name ILIKE ${`%${filters.plano}%`})`)
  }

  const ids = await prisma.$queryRaw<{ id: string }[]>`
    SELECT v.id FROM veterinarios v
    WHERE ${Prisma.join(conds, ' AND ')}
    ORDER BY CASE
      WHEN v.subscription_plan_code IN ('vet_pro', 'pro_plus') THEN 1
      WHEN v.subscription_plan_code IN ('vet_starter', 'pro') THEN 2
      ELSE 3
    END ASC`

  const order = new Map(ids.map((row, index) => [row.id, index]))
  const veterinarios = (
    await findVeterinarios({ id: { in: ids.map((r) => r.id) } }, ['user', 'especialidades', 'enderecos', 'avaliacoes', 'planos'])
  ).sort((a, b) => order.get(a.id)! - order.get(b.id)!)

  console.log(`[DEBUG] Encontrados ${veterinarios.length} veterinários`)
  return veterinarios.map(formatVeterinarioData)
}

export async function getVeterinarioById(id: string) {
  try {
    const [veterinario] = await findVeterinarios({ id }, [
      'user',
      'especialidades',
      'enderecos',
      'avaliacoes',
      'experiencias',
      'planos',
    ])
    if (!veterinario) throw statusError('Veterinário não encontrado', 404)

    const data = formatVeterinarioData(veterinario)
    const limitCheck = await canCreateAppointment(veterinario)
    return { ...data, limitReached: !limitCheck.allowed }
  } catch (error) {
    if ((error as { status?: number }).status === 404) throw error
    console.error('❌ [VeterinariosService] Erro inesperado ao buscar veterinário ID:', id, error)
    throw statusError('Veterinário não encontrado', 404)
  }
}

function parseJsonSafe(value: unknown) {
  if (typeof value === 'object' && value !== null) return value
  try {
    return typeof value === 'string' ? JSON.parse(value) : {}
  } catch (e) {
    console.error('⚠️ Erro ao fazer parse de JSON no VeterinariosService:', (e as Error).message)
    return {}
  }
}

function formatVeterinarioData(vet: VeterinarioLoaded) {
  const enderecoPrincipal = vet.enderecos?.find((end) => end.isPrimary) || vet.enderecos?.[0]

  const totalReviews = vet.avaliacoes?.length || 0
  let rating = 0
  if (totalReviews > 0) {
    const sum = vet.avaliacoes!.reduce((acc, curr) => acc + Number(curr.estrelas), 0)
    rating = Number.parseFloat((sum / totalReviews).toFixed(1))
  }

  let preco = 0
  const hasAddresses = vet.enderecos && vet.enderecos.length > 0
  if (vet.atendeOnline && !hasAddresses) {
    preco = Number(vet.precoConsultaOnline || 0)
  } else {
    preco = Number(enderecoPrincipal?.precoConsulta || vet.enderecos?.[0]?.precoConsulta || 0)
  }

  const locations =
    vet.enderecos?.map((end) => ({
      id: end.id,
      cidade: end.cidade,
      estado: end.estado,
      endereco: `${end.rua}, ${end.numero}, ${end.bairro}`,
      fullAddress: `${end.rua}, ${end.numero}, ${end.bairro}, ${end.cidade} - ${end.estado}`,
      preco: Number(end.precoConsulta || 0),
      availability: parseJsonSafe(end.horariosDisponibilidade),
      isPrimary: !!end.isPrimary,
      nomeClinica: end.nomeClinica,
      fotoUrl: end.fotoUrl,
    })) || []

  return {
    id: vet.id,
    nome: `${vet.user?.nome || 'Nome'} ${vet.user?.sobrenome || 'Sobrenome'}`,
    email: vet.user?.email || 'email@exemplo.com',
    fotoUrl: vet.fotoUrl || null,
    cidade: enderecoPrincipal?.cidade || 'Cidade não informada',
    estado: enderecoPrincipal?.estado || 'UF',
    endereco: enderecoPrincipal
      ? `${enderecoPrincipal.rua}, ${enderecoPrincipal.numero}, ${enderecoPrincipal.cidade}`
      : 'Endereço não informado',
    especialidades: vet.especialidades?.map((esp) => esp.nome) || ['Clínica Geral'],
    crmv: vet.crmv || 'CRMV não informado',
    bio: vet.bio || 'Veterinário especializado no cuidado de animais de estimação.',
    preco: preco,
    experiencias:
      vet.experiencias?.map((exp) => ({
        cargo: exp.cargo,
        local: exp.local,
        dataInicio: dateColumn(exp.dataInicio),
        dataFim: dateColumn(exp.dataFim),
        descricao: exp.descricao,
      })) || [],
    rating: rating,
    totalReviews: totalReviews,
    availability: enderecoPrincipal?.horariosDisponibilidade || {},
    clinica: enderecoPrincipal?.nomeClinica || null,
    creditos: vet.creditos || 0,
    locations: locations,
    atendeOnline: !!vet.atendeOnline,
    precoConsultaOnline: Number(vet.precoConsultaOnline || 0),
    horariosOnline: parseJsonSafe(vet.horariosOnline),
    planos:
      vet.planos?.map((plano) => ({
        id: plano.id,
        name: plano.name,
      })) || [],
  }
}
