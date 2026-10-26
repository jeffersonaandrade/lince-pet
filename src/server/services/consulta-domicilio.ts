import 'server-only'
import { DateTime } from 'luxon'
import { prisma } from '@/server/db'
import { HttpError } from '@/server/http'
import { updating } from '@/server/lucid'
import { prepareDateTimeString } from '@/server/services/agendamentos'
import { enderecoLiberado } from '@/lib/endereco-domicilio'
import { statusNormalizado } from '@/server/services/veterinario-dashboard'

const includeAceite = {
  tutor: { include: { user: true } },
  veterinario: { include: { user: true } },
} as const

const STATUS_PENDENTE = ['pendente', 'agendado', 'marcado']

/** Veterinário aceita a consulta em domicílio e passa a ver o endereço completo. */
export async function aceitarConsultaDomicilio(veterinarioId: string, id: string) {
  return prisma.$transaction(async (tx) => {
    const atual = await tx.agendamento.findFirst({ where: { id, veterinarioId }, include: includeAceite })
    if (!atual) throw new HttpError(404, { message: 'Agendamento não encontrado' })
    if (atual.tipoConsulta !== 'domicilio') {
      throw new HttpError(400, { message: 'Só a consulta em domicílio precisa de aceite para liberar o endereço.' })
    }
    if (enderecoLiberado(atual.status)) return { agendamento: atual, novo: false }
    if (statusNormalizado(atual.status) !== 'pendente') {
      throw new HttpError(400, { message: 'Esta consulta não pode mais ser aceita.' })
    }
    const gravado = await tx.agendamento.updateMany({
      where: { id, veterinarioId, status: { in: STATUS_PENDENTE } },
      data: updating({ status: 'confirmado', confirmadoEm: prepareDateTimeString(DateTime.now()) }),
    })
    if (gravado.count !== 1) {
      const deNovo = await tx.agendamento.findFirst({ where: { id, veterinarioId }, include: includeAceite })
      if (deNovo && enderecoLiberado(deNovo.status)) return { agendamento: deNovo, novo: false }
      throw new HttpError(409, { message: 'A consulta mudou. Atualize a agenda.' })
    }
    const agendamento = await tx.agendamento.findFirstOrThrow({ where: { id }, include: includeAceite })
    return { agendamento, novo: true }
  })
}
