import 'server-only'
import { DateTime } from 'luxon'
import type { Prisma } from '@prisma/client'
import { prisma } from '../db'
import type { UploadedFile } from '../http'

const isDev = () => process.env.NODE_ENV === 'development'

/** Equivalente a Agendamento.getStatusNormalizado(). */
export function statusNormalizado(status: string | null | undefined) {
  const s = status?.toLowerCase() || ''
  if (['pendente', 'agendado', 'marcado'].includes(s)) return 'pendente'
  if (['confirmado', 'confirmada'].includes(s)) return 'confirmado'
  if (['realizado', 'finalizado', 'concluido'].includes(s)) return 'realizado'
  if (['cancelado', 'cancelada'].includes(s)) return 'cancelado'
  return 'desconhecido'
}

export const findVeterinarioByUser = (userId: string) => prisma.veterinario.findFirst({ where: { userId } })

export async function estatisticas(veterinarioId: string) {
  const hoje = DateTime.now().startOf('day')
  const inicioDaSemana = hoje.startOf('week')
  const fimDaSemana = hoje.endOf('week')
  const inicioDoMes = hoje.startOf('month')
  const fimDoMes = hoje.endOf('month')

  const statusAgendados = ['pendente', 'confirmado', 'agendado', 'marcado', 'confirmada']
  const statusRealizados = ['realizado', 'finalizado', 'concluido']
  const todosStatusValidos = [...statusAgendados, ...statusRealizados]

  const [agendamentosHoje, agendamentosSemana, agendamentosMes, clientes] = await Promise.all([
    prisma.agendamento.count({
      where: { veterinarioId, dataConsulta: hoje.toSQLDate()!, status: { in: statusAgendados } },
    }),
    prisma.agendamento.count({
      where: {
        veterinarioId,
        dataConsulta: { gte: inicioDaSemana.toSQLDate()!, lte: fimDaSemana.toSQLDate()! },
        status: { in: todosStatusValidos },
      },
    }),
    prisma.agendamento.count({
      where: {
        veterinarioId,
        dataConsulta: { gte: inicioDoMes.toSQLDate()!, lte: fimDoMes.toSQLDate()! },
        status: { in: todosStatusValidos },
      },
    }),
    prisma.agendamento.findMany({
      where: { veterinarioId, tutorId: { not: null } },
      distinct: ['tutorId'],
      select: { tutorId: true },
    }),
  ])

  return { agendamentosHoje, agendamentosSemana, agendamentosMes, totalClientes: clientes.length }
}

export function estatisticasError(error: any) {
  return {
    message: 'Erro interno ao buscar estatísticas',
    error: error?.message,
    stack: isDev() ? error?.stack : undefined,
  }
}

export function agendamentosError(error: any) {
  return {
    message: 'Erro interno ao listar agendamentos',
    error: isDev() ? error?.message : undefined,
  }
}

function expandStatus(status: unknown) {
  const list = Array.isArray(status) ? (status as string[]) : String(status).split(',')
  const expanded = new Set<string>()
  list.forEach((raw) => {
    const s = String(raw).trim().toLowerCase()
    expanded.add(s)
    if (s === 'pendente') {
      expanded.add('agendado')
      expanded.add('marcado')
    } else if (s === 'confirmado') {
      expanded.add('confirmada')
    } else if (s === 'realizado') {
      expanded.add('concluido')
      expanded.add('finalizado')
    } else if (s === 'cancelado') {
      expanded.add('cancelada')
    }
  })
  return Array.from(expanded)
}

/** Lucid (`column.date`) consumia strings com DateTime.fromSQL. */
function formatDataConsulta(value: string | null) {
  if (value === null) return 'null'
  const dt = DateTime.fromSQL(value)
  return dt.isValid ? dt.toFormat('dd/MM/yyyy') : dt.toString()
}

type Veterinario = NonNullable<Awaited<ReturnType<typeof findVeterinarioByUser>>>

export async function listAgendamentos(veterinario: Veterinario, qs: Record<string, any>) {
  const { status, data_inicio, data_fim } = qs
  const where: Prisma.AgendamentoWhereInput = { veterinarioId: veterinario.id }
  const dataFilters: Prisma.AgendamentoWhereInput[] = []

  if (status) where.status = { in: expandStatus(status) }

  for (const [value, op] of [
    [data_inicio, 'gte'],
    [data_fim, 'lte'],
  ] as const) {
    if (!value) continue
    const sqlDate = DateTime.fromISO(String(value)).toSQLDate()
    // `data_consulta >= NULL` no MySQL não retorna nenhuma linha
    if (!sqlDate) return []
    dataFilters.push({ dataConsulta: { [op]: sqlDate } })
  }
  if (dataFilters.length) where.AND = dataFilters

  const agendamentos = await prisma.agendamento.findMany({
    where,
    include: {
      tutor: { include: { user: { select: { nome: true, sobrenome: true, celular: true, email: true } } } },
      pet: true,
    },
    orderBy: [{ dataConsulta: 'asc' }, { horarioConsulta: 'asc' }],
  })

  return agendamentos.map((agendamento) => {
    try {
      if (!agendamento.createdAt) throw new Error('createdAt nulo')
      const precoAgendamento = agendamento.precoConsulta
      return {
        id: agendamento.id,
        data_consulta: formatDataConsulta(agendamento.dataConsulta),
        horario_consulta: agendamento.horarioConsulta,
        tipo_consulta: agendamento.tipoConsulta,
        status: agendamento.status,
        tutor_nome: agendamento.tutor?.user?.nome || 'Tutor não identificado',
        tutor_sobrenome: agendamento.tutor?.user?.sobrenome || '',
        tutor_telefone: agendamento.tutor?.user?.celular || null,
        tutor_email: agendamento.tutor?.user?.email || null,
        pet_nome: agendamento.pet?.nome || 'Pet não identificado',
        pet_especie: agendamento.pet?.especie || '',
        pet_raca: agendamento.pet?.raca || '',
        pet_porte: agendamento.pet?.porte || '',
        observacoes: agendamento.observacoes,
        local_nome: agendamento.localNome,
        local_endereco: agendamento.localEndereco,
        preco_consulta:
          precoAgendamento && Number(precoAgendamento) > 0
            ? precoAgendamento
            : ['online', 'virtual', 'remoto'].includes(agendamento.tipoConsulta?.toLowerCase() || '')
              ? (veterinario.precoConsultaOnline ?? 0)
              : (veterinario.precoConsulta ?? 0),
        pet_foto_url: agendamento.pet?.fotoUrl,
        created_at: DateTime.fromJSDate(agendamento.createdAt).toFormat('dd/MM/yyyy HH:mm'),
      }
    } catch (err) {
      console.error('❌ [Dashboard] Erro ao formatar agendamento:', agendamento.id, err)
      return {
        id: agendamento.id,
        data_consulta: 'Data inválida',
        horario_consulta: agendamento.horarioConsulta || 'Horário não definido',
        tipo_consulta: agendamento.tipoConsulta || 'Não definido',
        status: agendamento.status || 'Desconhecido',
        tutor_nome: 'Erro ao carregar',
        pet_nome: 'Erro ao carregar',
        observacoes: agendamento.observacoes,
        created_at: 'Data inválida',
      }
    }
  })
}

const PHOTO_FIELDS = ['profile_pic', 'file', 'image', 'photo', 'avatar']
export const PHOTO_OPTIONS = { size: '5mb', extnames: ['jpg', 'jpeg', 'png', 'webp', 'gif'] }

export function pickPhoto(getFile: (name: string) => UploadedFile | null) {
  for (const name of PHOTO_FIELDS) {
    const file = getFile(name)
    if (file) return file
  }
  return null
}