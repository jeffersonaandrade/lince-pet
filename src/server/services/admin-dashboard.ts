import 'server-only'
import type { UserType } from '@/generated/prisma/client'
import { STATUS_AGENDA, contagemAgenda, type ContasAtivas, type PainelAdmin } from '@/lib/admin-dashboard'
import { dataLocal } from './assinatura-regras'
import { prisma } from '../db'

/** Mês civil de Brasília, no formato gravado em agendamentos.data_consulta (YYYY-MM-DD). */
export function periodoDoMes(agora = new Date()) {
  const mes = dataLocal(agora).slice(0, 7)
  const [ano, numero] = mes.split('-').map(Number)
  const fim = numero === 12 ? `${ano + 1}-01-01` : `${ano}-${String(numero + 1).padStart(2, '0')}-01`
  return { mes, inicio: `${mes}-01`, fim }
}

const TIPOS: UserType[] = ['tutor', 'veterinario', 'clinica', 'prestador']

function contasZeradas(): ContasAtivas {
  return { tutor: 0, veterinario: 0, clinica: 0, prestador: 0 }
}

async function agenda(inicio: string, fim: string, lado: 'consultas' | 'pedidos') {
  const linhas = await prisma.agendamento.groupBy({
    by: ['status'],
    where: {
      dataConsulta: { gte: inicio, lt: fim },
      status: { in: [...STATUS_AGENDA] },
      ...(lado === 'consultas' ? { veterinarioId: { not: null } } : { prestadorId: { not: null } }),
    },
    _count: { _all: true },
  })
  return contagemAgenda(linhas.map((linha) => ({ status: linha.status, quantidade: linha._count._all })))
}

/** Contagens do painel. Só números agregados. */
export async function consultarPainel(agora = new Date()): Promise<PainelAdmin> {
  const { mes, inicio, fim } = periodoDoMes(agora)
  const [crmv, responsavelTecnico, recuperacoesCnpj, usuarios, consultas, pedidos, assinaturas, planos] = await Promise.all([
    prisma.veterinario.count({ where: { crmvStatus: 'pendente', crmv: { not: null } } }),
    prisma.clinica.count({ where: { rtStatus: 'pendente' } }),
    prisma.recuperacaoCnpj.count({ where: { status: 'pendente' } }),
    prisma.user.groupBy({ by: ['userType'], where: { ativo: 1 }, _count: { _all: true } }),
    agenda(inicio, fim, 'consultas'),
    agenda(inicio, fim, 'pedidos'),
    prisma.subscription.groupBy({ by: ['planId'], where: { status: 'active' }, _count: { _all: true } }),
    prisma.subscriptionPlan.findMany({ select: { id: true, code: true } }),
  ])

  const contas = contasZeradas()
  for (const grupo of usuarios) {
    if (TIPOS.includes(grupo.userType)) contas[grupo.userType] = grupo._count._all
  }

  const codigo = new Map(planos.map((plano) => [plano.id, plano.code]))
  const porPlano = assinaturas
    .map((grupo) => ({ codigo: codigo.get(grupo.planId) ?? 'sem plano', quantidade: grupo._count._all }))
    .sort((a, b) => a.codigo.localeCompare(b.codigo))

  return {
    mes,
    filas: { crmv, responsavelTecnico, recuperacoesCnpj },
    contas,
    agenda: { consultas, pedidos },
    assinaturas: { total: porPlano.reduce((soma, plano) => soma + plano.quantidade, 0), porPlano },
  }
}
