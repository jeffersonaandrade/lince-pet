import 'server-only'
import { after } from 'next/server'
import { prisma } from '../db'
import { HttpError } from '../http'
import { now, uuid } from '../lucid'
import type { CurrentUser } from '../auth/session'
import { assertAcessoProntuario } from './prontuario'
import { avisarExame } from './exames-avisos'
import { TIPO_EXAME } from './exames'
import { chaveDoLaudo, ehPdf, removerLaudo, salvarLaudo, TAMANHO_MAXIMO_LAUDO, urlAssinadaDoLaudo } from './laudos-storage'

/**
 * Laudo do exame: a clínica do agendamento envia um PDF (até 10 MB) depois de marcar o exame como realizado; enviar de novo
 * substitui. Quem vê o prontuário do pet (tutor dono, clínica, vet que encaminhou) baixa por URL assinada.
 */

const erro = (message: string, status = 400) => new HttpError(status, { status, message })

export type ArquivoLaudo = { buffer: Buffer; nome: string }

export async function enviarLaudo(clinicaId: string, userId: string | null, agendamentoId: string, arquivo: ArquivoLaudo | null) {
  const a = await prisma.agendamento.findFirst({
    where: { id: agendamentoId, clinicaId, tipoConsulta: TIPO_EXAME },
    include: { laudo: true },
  })
  if (!a) throw erro('Agendamento não encontrado', 404)
  if (a.status !== 'realizado') throw erro('Marque o exame como realizado antes de enviar o laudo')
  if (!arquivo?.buffer.length) throw erro('Envie o laudo em PDF')
  if (arquivo.buffer.length > TAMANHO_MAXIMO_LAUDO) throw erro('O laudo deve ter no máximo 10 MB')
  if (!ehPdf(arquivo.buffer)) throw erro('O laudo precisa ser um arquivo PDF')

  const caminho = chaveDoLaudo(clinicaId, agendamentoId)
  await salvarLaudo(caminho, arquivo.buffer)
  const dados = {
    caminho,
    nomeArquivo: arquivo.nome.slice(0, 255) || 'laudo.pdf',
    tamanhoBytes: arquivo.buffer.length,
    enviadoPor: userId,
    enviadoEm: now(),
  }
  try {
    await prisma.laudoExame.upsert({
      where: { agendamentoId },
      create: { id: uuid(), agendamentoId, ...dados },
      update: dados,
    })
  } catch (error) {
    await removerLaudo(caminho)
    throw error
  }
  if (a.laudo) await removerLaudo(a.laudo.caminho)
  after(() => avisarExame('laudo', agendamentoId))
  return { nome_arquivo: dados.nomeArquivo, enviado_em: dados.enviadoEm }
}

/** URL assinada do laudo; 403 para quem não acessa o prontuário do pet. */
export async function urlDoLaudo(user: CurrentUser, agendamentoId: string) {
  const a = await prisma.agendamento.findFirst({
    where: { id: agendamentoId, tipoConsulta: TIPO_EXAME },
    select: { petId: true, laudo: { select: { caminho: true } } },
  })
  if (!a?.petId) throw erro('Laudo não encontrado', 404)
  try {
    await assertAcessoProntuario(user, a.petId)
  } catch (error) {
    if (error instanceof HttpError && error.status === 404) throw erro('Você não tem acesso a este laudo', 403)
    throw error
  }
  if (!a.laudo) throw erro('Laudo ainda não enviado', 404)
  return { url: await urlAssinadaDoLaudo(a.laudo.caminho) }
}
