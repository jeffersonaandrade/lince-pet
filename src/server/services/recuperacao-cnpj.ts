import 'server-only'
import { createHash, randomBytes, randomUUID } from 'node:crypto'
import { prisma } from '../db'
import { HttpError } from '../http'
import { updating } from '../lucid'
import { hashPassword } from '../auth/password'
import { normalizarCnpj } from './cnpj'
import { defaultFrom, escapeHtml, sendMail } from './mail'
import { forgotPassword } from './auth'

const erro = (message: string, status = 400) => new HttpError(status, { message })
const hash = (token: string) => createHash('sha256').update(token).digest('hex')
const mensagem = { message: 'Se os dados permitirem abrir uma solicitação, enviaremos a confirmação para o e-mail informado. A recuperação depende de comprovação e análise administrativa.' }
function texto(valor: unknown, minimo: number, maximo: number, campo: string) {
  if (typeof valor !== 'string' || valor.trim().length < minimo || valor.trim().length > maximo) throw erro(`Preencha ${campo} (${minimo} a ${maximo} caracteres).`)
  return valor.trim()
}

/** Confirmar e-mail não comprova titularidade e nunca concede acesso à clínica. */
export async function solicitarRecuperacao(body: Record<string, unknown>) {
  const cnpj = normalizarCnpj(body.cnpj)
  const emailNovo = texto(body.email, 5, 255, 'e-mail').toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailNovo)) throw erro('E-mail inválido.')
  const representante = texto(body.representante, 3, 255, 'nome do representante')
  const relato = texto(body.relato, 20, 2000, 'descrição da solicitação')
  const clinicas = await prisma.$queryRaw<{ id: string; user_id: string }[]>`SELECT id,user_id FROM clinicas WHERE regexp_replace(cnpj, '\D', '', 'g')=${cnpj}`
  if (clinicas.length !== 1 || !clinicas[0].user_id) return mensagem
  const clinica = clinicas[0]
  const user = await prisma.user.findUnique({ where: { id: clinica.user_id } })
  if (!user || user.userType !== 'clinica' || user.isAdmin === 1) return mensagem
  if (await prisma.user.findFirst({ where: { email: { equals: emailNovo, mode: 'insensitive' } } })) return mensagem
  const token = randomBytes(32).toString('hex'), agora = new Date()
  const pedido = await prisma.$transaction(async tx => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`recuperacao-email:${emailNovo}`}, 0))`
    const recentes = await tx.recuperacaoCnpj.count({ where: { emailNovo, createdAt: { gte: new Date(agora.getTime() - 86400000) } } })
    if (recentes >= 3) return null
    return tx.recuperacaoCnpj.create({ data: {
      id: randomUUID(), clinicaId: clinica.id, userId: user.id, cnpj, emailOriginal: user.email, versaoOriginal: user.tokenVersion,
      emailNovo, representante, relato, tokenHash: hash(token), tokenExpiraEm: new Date(agora.getTime() + 86400000),
    } })
  })
  if (!pedido) return mensagem
  const url = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/recuperar-clinica?token=${token}`
  await sendMail({ from: defaultFrom(), to: emailNovo, subject: 'Confirme a solicitação de recuperação de clínica — Lince Pet',
    html: `<p>Foi solicitada recuperação de acesso à clínica do CNPJ ${cnpj}.</p><p><a href="${escapeHtml(url)}">Confirmar meu e-mail</a></p><p>O link vence em 24 horas. Esta confirmação não concede acesso: o administrador ainda precisará comprovar a representação. Se você não solicitou, ignore.</p>`,
  })
  return mensagem
}

export async function confirmarEmailRecuperacao(token: unknown) {
  if (typeof token !== 'string' || !/^[a-f0-9]{64}$/.test(token)) throw erro('Link inválido ou expirado.')
  const atualizado = await prisma.recuperacaoCnpj.updateMany({
    where: { tokenHash: hash(token), status: 'aguardando_email', tokenExpiraEm: { gt: new Date() } },
    data: { status: 'pendente', emailConfirmadoEm: new Date(), tokenHash: null },
  })
  if (atualizado.count !== 1) throw erro('Link inválido, já utilizado ou expirado.')
  return { message: 'E-mail confirmado. Aguarde a análise de representação pelo administrador; nenhum acesso foi transferido.' }
}

export async function listarRecuperacoes() {
  return prisma.recuperacaoCnpj.findMany({
    where: { status: { in: ['pendente', 'aprovado', 'reprovado'] } }, orderBy: { createdAt: 'desc' }, take: 100,
    select: { id: true, cnpj: true, emailOriginal: true, emailNovo: true, representante: true, relato: true, status: true, createdAt: true, evidencia: true, faturamentoConferido: true, justificativa: true, administradorId: true, decididoEm: true },
  })
}

export async function decidirRecuperacao(id: string, administradorId: string, body: Record<string, unknown>) {
  if (body.decisao !== 'aprovar' && body.decisao !== 'reprovar') throw erro('Decisão inválida.')
  const aprovar = body.decisao === 'aprovar'
  const justificativa = texto(body.justificativa, 20, 2000, 'justificativa')
  const evidencia = aprovar ? texto(body.evidencia, 20, 2000, 'referência da comprovação de representação') : null
  if (aprovar && body.representacaoConferida !== true) throw erro('Confirme a conferência da representação antes de aprovar.')
  const senhaInutilizavel = aprovar ? await hashPassword(randomBytes(48).toString('hex')) : ''
  const pedido = await prisma.$transaction(async tx => {
    const atual = await tx.recuperacaoCnpj.findUnique({ where: { id } })
    if (!atual) throw erro('Solicitação não encontrada.', 404)
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`recuperacao-cnpj:${atual.cnpj}`}, 0))`
    const decidido = await tx.recuperacaoCnpj.updateMany({ where: { id, status: 'pendente', emailConfirmadoEm: { not: null } },
      data: { status: aprovar ? 'aprovado' : 'reprovado', evidencia, faturamentoConferido: aprovar && body.faturamentoConferido === true, justificativa, administradorId, decididoEm: new Date() } })
    if (decidido.count !== 1) throw erro('Solicitação já decidida ou e-mail não confirmado.', 409)
    if (!aprovar) return atual
    const conta = await tx.user.findUnique({ where: { id: atual.userId } })
    const clinica = await tx.clinica.findUnique({ where: { id: atual.clinicaId } })
    if (!conta || conta.ativo !== 1 || conta.isAdmin === 1 || conta.userType !== 'clinica' || !clinica || clinica.userId !== conta.id || normalizarCnpj(clinica.cnpj) !== atual.cnpj) throw erro('Cadastro incompatível ou desativado: encaminhe para análise manual.', 409)
    const faturamento = await tx.subscription.count({ where: { clinicaId: clinica.id, OR: [{ asaasSubscriptionId: { not: null } }, { asaasCustomerId: { not: null } }] } })
    if (faturamento > 0 && body.faturamentoConferido !== true) throw erro('Confira e atualize manualmente o contato de faturamento no Asaas e registre essa conferência antes de aprovar.', 409)
    if (await tx.clinica.count({ where: { userId: conta.id } }) !== 1) throw erro('Conta com múltiplas clínicas: exige análise manual específica.', 409)
    if (await tx.user.findFirst({ where: { email: { equals: atual.emailNovo, mode: 'insensitive' } } })) throw erro('O novo e-mail já está em uso. Solicite outro e-mail.', 409)
    const trocado = await tx.user.updateMany({ where: { id: conta.id, email: atual.emailOriginal, tokenVersion: atual.versaoOriginal }, data: updating({
      email: atual.emailNovo, password: senhaInutilizavel, tokenVersion: { increment: 1 }, isEmailVerified: 1, redefinicaoSenhaObrigatoria: true,
      googleAccessToken: null, googleRefreshToken: null, googleTokenExpiresAt: null, googleCalendarAuthorized: 0,
    }) })
    if (trocado.count !== 1) throw erro('O acesso mudou desde a solicitação. Refaça a análise com uma nova solicitação.', 409)
    await tx.passwordResetToken.deleteMany({ where: { userId: conta.id } })
    await tx.pushInscricao.deleteMany({ where: { userId: conta.id } })
    return atual
  })
  if (!aprovar) return { message: 'Solicitação reprovada. O acesso original foi preservado.' }
  let emailEnviado = true
  try { await forgotPassword(pedido.emailNovo) } catch {
    emailEnviado = false
    console.error('[recuperacao-cnpj] falha no envio de redefinição', { solicitacaoId: id })
  }
  return { message: emailEnviado ? 'Acesso recuperado. Sessões antigas encerradas; redefinição enviada ao novo e-mail.' : 'Acesso recuperado e sessões antigas encerradas. Falhou o envio: use “Esqueci minha senha” com o novo e-mail para tentar novamente.', emailEnviado }
}
