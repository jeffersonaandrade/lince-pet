import 'server-only'
import { prisma } from '../db'
import { HttpError } from '../http'
import { updating } from '../lucid'
import { bloquearAgenda } from './agenda-lock'
import { DIAS_SEMANA, normalizarGrade } from '@/lib/horarios'

const erro = (message: string) => new HttpError(422, { message })
export function validarAgendaConfig(body: Record<string, unknown>) {
  const inteiro = (key: string, min: number, max: number) => {
    const n = body[key]
    if (typeof n !== 'number' || !Number.isInteger(n) || n < min || n > max) throw erro(`${key}: informe um inteiro entre ${min} e ${max}.`)
    return n
  }
  if (typeof body.atendeDomicilio !== 'boolean') throw erro('Informe se atende a domicílio.')
  const preco = body.precoConsultaDomicilio
  if (typeof preco !== 'number' || !Number.isFinite(preco) || preco < 0 || preco > 999999 || (body.atendeDomicilio && preco <= 0)) throw erro('Informe um preço domiciliar válido.')
  if (!body.horariosDomicilio || typeof body.horariosDomicilio !== 'object' || Array.isArray(body.horariosDomicilio)) throw erro('Grade domiciliar inválida.')
  if (Object.values(body.horariosDomicilio).some(v => !Array.isArray(v) || v.length > 48 || v.some(h => typeof h !== 'string'))) throw erro('Grade domiciliar inválida.')
  const grade = normalizarGrade(body.horariosDomicilio)
  for (const [dia, horarios] of Object.entries(grade)) {
    if (!(DIAS_SEMANA as readonly string[]).includes(dia) || horarios.length > 48 || horarios.some(h => !/^([01]\d|2[0-3]):(00|30)$/.test(h))) throw erro('Use horários de meia em meia hora na grade domiciliar.')
    grade[dia] = [...new Set(horarios)].sort()
  }
  if (body.atendeDomicilio && !Object.values(grade).some(h => h.length)) throw erro('Selecione os horários de atendimento a domicílio.')
  return {
    duracaoPresencialMin: inteiro('duracaoPresencialMin', 15, 240), duracaoOnlineMin: inteiro('duracaoOnlineMin', 15, 240),
    duracaoDomicilioMin: inteiro('duracaoDomicilioMin', 15, 240), deslocamentoMin: inteiro('deslocamentoMin', 0, 240),
    atendeDomicilio: body.atendeDomicilio ? 1 : 0, precoConsultaDomicilio: preco, horariosDomicilio: grade,
  }
}

export async function obterAgendaConfig(veterinarioId: string) {
  const vet = await prisma.veterinario.findUniqueOrThrow({ where: { id: veterinarioId } })
  return {
    duracaoPresencialMin: vet.duracaoPresencialMin, duracaoOnlineMin: vet.duracaoOnlineMin,
    duracaoDomicilioMin: vet.duracaoDomicilioMin, deslocamentoMin: vet.deslocamentoMin,
    atendeDomicilio: !!vet.atendeDomicilio, precoConsultaDomicilio: Number(vet.precoConsultaDomicilio ?? 0),
    horariosDomicilio: normalizarGrade(vet.horariosDomicilio),
  }
}
export async function salvarAgendaConfig(veterinarioId: string, body: Record<string, unknown>) {
  const data = validarAgendaConfig(body)
  await prisma.$transaction(async tx => {
    await bloquearAgenda(tx, 'veterinario', veterinarioId)
    await tx.veterinario.update({ where: { id: veterinarioId }, data: updating(data) })
  })
}
