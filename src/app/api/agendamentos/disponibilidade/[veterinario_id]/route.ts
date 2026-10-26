import { DateTime } from 'luxon'
import { prisma } from '@/server/db'
import { ApiRequest, badRequest, json, notFound, route } from '@/server/http'
import { requireUser } from '@/server/auth/session'
import { bloqueiosDoPeriodo, diaInteiroBloqueado, horariosBloqueadosNaData } from '@/server/services/bloqueios'
import { modalidadeConsulta, intervalosConflitam } from '@/domain/agenda'
import { cabeNaGrade, consultaBloqueada, intervaloDaReserva, ocupacoesDaPessoa, periodoDaConsulta } from '@/server/services/agenda-profissional'
import { FUSO_CONSULTA } from '@/server/services/agendamentos'

export const GET = route<{ veterinario_id: string }>(async (req, { veterinario_id }) => {
  const request = await ApiRequest.from(req)
  await requireUser(request)
  const data = request.text('data')
  const dia = data && /^\d{4}-\d{2}-\d{2}$/.test(data) ? DateTime.fromISO(data, { zone: FUSO_CONSULTA }) : null
  const tipo = modalidadeConsulta(request.input('tipo_consulta') ?? 'presencial')
  if (!dia?.isValid) return badRequest({ message: 'Parâmetro data é obrigatório (formato: YYYY-MM-DD)' })
  if (!tipo) return badRequest({ message: 'Modalidade de consulta inválida.' })
  const vet = await prisma.veterinario.findUnique({ where: { id: veterinario_id } })
  if (!vet) return notFound({ message: 'Veterinário não encontrado' })
  const enderecoId = request.text('endereco_id')
  if (enderecoId && !/^[a-f\d-]{36}$/i.test(enderecoId)) return badRequest({ message: 'Endereço inválido.' })
  const [bloqueios, reservas, enderecos] = await Promise.all([
    bloqueiosDoPeriodo(veterinario_id, dia.minus({ days: 1 }).toISODate()!, dia.plus({ days: 1 }).toISODate()!),
    ocupacoesDaPessoa(prisma, { id: vet.id, userId: vet.userId, tipo: 'veterinario' }, dia, dia.endOf('day')),
    tipo === 'presencial' ? prisma.veterinarioEndereco.findMany({ where: { veterinarioId: vet.id, ativo: 1, ...(enderecoId ? { id: enderecoId } : {}) } }) : [],
  ])
  const periodos = reservas.map(intervaloDaReserva).filter(p => p !== null)
  const grades = tipo === 'domicilio' ? (vet.atendeDomicilio ? [vet.horariosDomicilio] : [])
    : tipo === 'online' ? (vet.atendeOnline ? [vet.horariosOnline] : []) : vet.atendePresencial ? enderecos.map(e => e.horariosDisponibilidade) : []
  const horariosOcupados: string[] = []
  const agora = DateTime.now()
  for (let minuto = 0; minuto < 24 * 60; minuto += 30) {
    const horario = dia.plus({ minutes: minuto }).toFormat('HH:mm')
    const p = periodoDaConsulta(vet, data!, horario, tipo)
    const candidato = { inicio: p.inicio.toMillis(), fim: p.fim.toMillis(), deslocamentoMin: p.deslocamentoMin }
    if (p.inicio <= agora || !grades.some(g => cabeNaGrade(g, p.inicio, p.fim))
      || consultaBloqueada(bloqueios, p.inicio.minus({ minutes: p.deslocamentoMin }), p.fim.plus({ minutes: p.deslocamentoMin }))
      || periodos.some(r => intervalosConflitam(candidato, r))) horariosOcupados.push(horario)
  }
  return json({ data, horarios_ocupados: horariosOcupados,
    horarios_bloqueados: horariosBloqueadosNaData(bloqueios, data!), dia_bloqueado: diaInteiroBloqueado(bloqueios, data!),
    duracao_min: periodoDaConsulta(vet, data!, '00:00', tipo).duracaoMin,
    deslocamento_min: tipo === 'domicilio' ? vet.deslocamentoMin : 0,
  }, 200, { headers: { 'Cache-Control': 'private, no-store' } })
})
