import 'server-only'
import vine from '@vinejs/vine'
import { prisma } from '../db'
import { HttpError } from '../http'
import { updating } from '../lucid'
import { nomeCompleto } from './agendamentos'
import { avisarUsuario } from './aviso-usuario'

/**
 * Análise manual do admin da Lince: CRMV de cada vet e responsável técnico (RT) de cada clínica com exames.
 * Só `aprovado` libera: vet na busca e recebendo agendamento; exames da clínica visíveis ao público.
 * Trocar o CRMV ou o RT volta para `pendente`.
 */

export type StatusAnalise = 'pendente' | 'aprovado' | 'reprovado'
export const APROVADO: StatusAnalise = 'aprovado'
export const FORMATO_CRMV = /^\d+-[A-Z]{2}$/
export const MAX_MOTIVO = 500
export const MENSAGEM_CRMV_EM_ANALISE = 'Este profissional ainda não pode receber agendamentos: o CRMV está em análise.'

const erro = (message: string, status = 400) => new HttpError(status, { status, message })

export const decisaoValidator = vine.compile(
  vine.object({
    decisao: vine.enum(['aprovar', 'reprovar'] as const),
    motivo: vine.string().trim().maxLength(MAX_MOTIVO).optional().nullable(),
  })
)

/** Reprovar exige motivo; aprovar limpa o motivo anterior. */
export function resolverDecisao(d: { decisao: 'aprovar' | 'reprovar'; motivo?: string | null }) {
  const motivo = d.motivo?.trim() || null
  if (d.decisao === 'reprovar' && !motivo) throw erro('Informe o motivo da reprovação')
  return d.decisao === 'aprovar'
    ? { status: 'aprovado' as const, motivo: null }
    : { status: 'reprovado' as const, motivo }
}

/** "12345-SP" -> "SP". */
export const ufDoCrmv = (crmv: string | null | undefined) => (crmv && FORMATO_CRMV.test(crmv) ? crmv.split('-')[1] : null)

/** Status depois de salvar um CRMV: o mesmo número mantém a análise; número novo ou reenvio de reprovado volta para pendente. */
export function statusAposTroca(anterior: string | null | undefined, novo: string, statusAtual: string | null | undefined) {
  return anterior === novo && statusAtual && statusAtual !== 'reprovado' ? statusAtual : 'pendente'
}

export async function listarPendentes() {
  const [vets, clinicas] = await Promise.all([
    prisma.veterinario.findMany({
      where: { crmvStatus: 'pendente', crmv: { not: null } },
      include: { user: true },
      orderBy: [{ crmvEnviadoEm: 'asc' }, { createdAt: 'asc' }],
    }),
    prisma.clinica.findMany({
      where: { rtStatus: 'pendente' },
      include: { user: true },
      orderBy: [{ rtEnviadoEm: 'asc' }, { createdAt: 'asc' }],
    }),
  ])
  return {
    veterinarios: vets.map((v) => ({
      id: v.id,
      nome: v.user ? nomeCompleto(v.user) : 'Veterinário',
      email: v.user?.email ?? null,
      crmv: v.crmv,
      uf: ufDoCrmv(v.crmv),
      enviado_em: (v.crmvEnviadoEm ?? v.updatedAt ?? v.createdAt)?.toISOString() ?? null,
    })),
    clinicas: clinicas.map((c) => ({
      id: c.id,
      nome: c.nomeClinica || 'Clínica',
      email: c.user?.email ?? null,
      cnpj: c.cnpj,
      cidade: c.cidade,
      estado: c.estado,
      rt_nome: c.rtNome,
      rt_crmv: c.rtCrmv,
      uf: ufDoCrmv(c.rtCrmv),
      enviado_em: (c.rtEnviadoEm ?? c.updatedAt)?.toISOString() ?? null,
    })),
  }
}

const TEXTO_DECISAO = {
  crmv: {
    aprovado: { titulo: 'CRMV aprovado', mensagem: 'Seu CRMV foi aprovado. Seu perfil já aparece na busca e pode receber agendamentos.' },
    reprovado: { titulo: 'CRMV reprovado', mensagem: 'Seu CRMV não foi aprovado. Corrija o número no seu perfil para uma nova análise.' },
  },
  rt: {
    aprovado: { titulo: 'Responsável técnico aprovado', mensagem: 'O responsável técnico da clínica foi aprovado. Seus exames já podem aparecer na busca.' },
    reprovado: { titulo: 'Responsável técnico reprovado', mensagem: 'O responsável técnico da clínica não foi aprovado. Corrija os dados no perfil para uma nova análise.' },
  },
} as const

export async function decidirCrmv(veterinarioId: string, body: unknown) {
  const { status, motivo } = resolverDecisao(await decisaoValidator.validate(body))
  const vet = await prisma.veterinario.findUnique({ where: { id: veterinarioId }, include: { user: true } })
  if (!vet) throw erro('Veterinário não encontrado', 404)
  if (vet.crmvStatus !== 'pendente') throw erro('Este CRMV não está em análise', 409)
  await prisma.veterinario.update({ where: { id: vet.id }, data: updating({ crmvStatus: status, crmvMotivo: motivo }) })
  if (vet.user) {
    const texto = TEXTO_DECISAO.crmv[status]
    await avisarUsuario(vet.user, {
      tipo: status === 'aprovado' ? 'CRMV_APROVADO' : 'CRMV_REPROVADO',
      titulo: texto.titulo,
      mensagem: motivo ? `${texto.mensagem} Motivo: ${motivo}` : texto.mensagem,
      detalhes: [['CRMV', vet.crmv], ['Motivo', motivo]],
    })
  }
  return { id: vet.id, status, motivo }
}

export async function decidirRt(clinicaId: string, body: unknown) {
  const { status, motivo } = resolverDecisao(await decisaoValidator.validate(body))
  const clinica = await prisma.clinica.findUnique({ where: { id: clinicaId }, include: { user: true } })
  if (!clinica) throw erro('Clínica não encontrada', 404)
  if (clinica.rtStatus !== 'pendente') throw erro('Este responsável técnico não está em análise', 409)
  await prisma.clinica.update({ where: { id: clinica.id }, data: updating({ rtStatus: status, rtMotivo: motivo }) })
  if (clinica.user) {
    const texto = TEXTO_DECISAO.rt[status]
    await avisarUsuario(clinica.user, {
      tipo: status === 'aprovado' ? 'RT_APROVADO' : 'RT_REPROVADO',
      titulo: texto.titulo,
      mensagem: motivo ? `${texto.mensagem} Motivo: ${motivo}` : texto.mensagem,
      detalhes: [['Responsável técnico', clinica.rtNome], ['CRMV', clinica.rtCrmv], ['Motivo', motivo]],
    })
  }
  return { id: clinica.id, status, motivo }
}

export const rtValidator = vine.compile(
  vine.object({
    rt_nome: vine.string().trim().minLength(3).maxLength(255),
    rt_crmv: vine.string().trim().toUpperCase().regex(FORMATO_CRMV),
  })
)

/** A clínica informa o RT; nome ou CRMV novo volta a análise para pendente. */
export async function salvarRt(clinicaId: string, body: unknown) {
  let d
  try {
    d = await rtValidator.validate(body)
  } catch {
    throw erro('Informe o nome do responsável técnico e o CRMV no formato 12345-SP', 422)
  }
  const clinica = await prisma.clinica.findUnique({ where: { id: clinicaId } })
  if (!clinica) throw erro('Clínica não encontrada', 404)
  const mesmoRt = clinica.rtNome === d.rt_nome && clinica.rtCrmv === d.rt_crmv
  const status = statusAposTroca(mesmoRt ? d.rt_crmv : null, d.rt_crmv, clinica.rtStatus)
  const atualizada = await prisma.clinica.update({
    where: { id: clinicaId },
    data: updating({
      rtNome: d.rt_nome,
      rtCrmv: d.rt_crmv,
      ...(status === 'pendente' ? { rtStatus: 'pendente', rtMotivo: null, rtEnviadoEm: new Date() } : {}),
    }),
  })
  return serializarRt(atualizada)
}

export const serializarRt = (c: { rtNome: string | null; rtCrmv: string | null; rtStatus: string | null; rtMotivo: string | null }) => ({
  rt_nome: c.rtNome,
  rt_crmv: c.rtCrmv,
  rt_status: c.rtStatus,
  rt_motivo: c.rtMotivo,
})
