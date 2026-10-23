import 'server-only'
import webpush from 'web-push'
import { prisma } from '../db'
import { env } from '../env'
import { creating, updating } from '../lucid'
import { HttpError } from '../http'

const MAX_INSCRICOES = 10

/** Provedores conhecidos; nunca enviar para hosts escolhidos livremente pelo cliente. */
export function endpointPushPermitido(endpoint: string) {
  try {
    const url = new URL(endpoint)
    return url.protocol === 'https:' && !url.username && !url.password && !url.port && (
      url.hostname === 'fcm.googleapis.com' ||
      url.hostname === 'updates.push.services.mozilla.com' ||
      url.hostname.endsWith('.push.apple.com') ||
      url.hostname.endsWith('.notify.windows.com')
    )
  } catch {
    return false
  }
}

/**
 * Notificações do navegador (Web Push), por aparelho inscrito.
 * Sem VAPID_PUBLIC_KEY/VAPID_PRIVATE_KEY o push fica desligado sem erro.
 * Falha no push nunca derruba o fluxo que o chamou.
 */

export type InscricaoPush = { endpoint: string; keys: { p256dh: string; auth: string } }
export type AvisoPush = { titulo: string; mensagem: string; url: string }

export function chavePublicaVapid() {
  return env('VAPID_PUBLIC_KEY') ?? null
}

function vapid() {
  const publicKey = env('VAPID_PUBLIC_KEY')
  const privateKey = env('VAPID_PRIVATE_KEY')
  if (!publicKey || !privateKey) return null
  return { subject: env('VAPID_SUBJECT') ?? 'mailto:contato@lincepet.com', publicKey, privateKey }
}

export function inscricaoValida(valor: unknown): valor is InscricaoPush {
  const v = valor as Partial<InscricaoPush> | null | undefined
  return (
    typeof v?.endpoint === 'string' &&
    endpointPushPermitido(v.endpoint) &&
    v.endpoint.length <= 2000 &&
    typeof v.keys?.p256dh === 'string' &&
    typeof v.keys?.auth === 'string' &&
    v.keys.p256dh.length <= 255 &&
    v.keys.auth.length <= 255
  )
}

/** Cadastra o aparelho; o mesmo endpoint troca de dono se outro usuário entrar nele. */
export async function salvarInscricao(userId: string, inscricao: InscricaoPush, userAgent?: string | null) {
  if (!inscricaoValida(inscricao)) throw new HttpError(422, { message: 'Inscrição push inválida' })
  const dados = {
    userId,
    p256dh: inscricao.keys.p256dh,
    auth: inscricao.keys.auth,
    userAgent: userAgent?.slice(0, 500) ?? null,
  }
  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`push-endpoint:${inscricao.endpoint}`}, 0))`
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`push:${userId}`}, 0))`
    const existente = await tx.pushInscricao.findUnique({ where: { endpoint: inscricao.endpoint } })
    if (existente?.userId !== userId && await tx.pushInscricao.count({ where: { userId } }) >= MAX_INSCRICOES) {
      throw new HttpError(409, { message: 'Limite de aparelhos atingido. Remova uma inscrição antiga.' })
    }
    await tx.pushInscricao.upsert({
      where: { endpoint: inscricao.endpoint },
      create: creating({ endpoint: inscricao.endpoint, ...dados }),
      update: updating(dados),
    })
  })
}

export async function removerInscricao(userId: string, endpoint: string) {
  await prisma.pushInscricao.deleteMany({ where: { userId, endpoint } })
}

const statusDoErro = (error: unknown) =>
  error && typeof error === 'object' ? (error as { statusCode?: number }).statusCode : undefined

export async function enviarPush(userId: string, aviso: AvisoPush) {
  const chaves = vapid()
  if (!chaves) return { enviados: 0, removidos: 0 }

  const resumo = { enviados: 0, removidos: 0 }
  try {
    const inscricoes = await prisma.pushInscricao.findMany({ where: { userId }, take: MAX_INSCRICOES, orderBy: { id: 'asc' } })
    const corpo = JSON.stringify({ title: aviso.titulo, body: aviso.mensagem, url: aviso.url })

    await Promise.all(
      inscricoes.map(async (i) => {
        // Também recusa endpoints antigos, cadastrados antes da validação.
        if (!endpointPushPermitido(i.endpoint)) return
        try {
          await webpush.sendNotification({ endpoint: i.endpoint, keys: { p256dh: i.p256dh, auth: i.auth } }, corpo, {
            vapidDetails: chaves,
            TTL: 60 * 60 * 24,
            timeout: 5000,
          })
          resumo.enviados++
        } catch (error) {
          const status = statusDoErro(error)
          if (status === 404 || status === 410) {
            await prisma.pushInscricao.deleteMany({ where: { id: i.id } })
            resumo.removidos++
          } else {
            console.error('[Push] Falha ao enviar notificação do navegador:', status ?? error)
          }
        }
      })
    )
  } catch (error) {
    console.error('[Push] Falha ao carregar inscrições:', error)
  }
  return resumo
}
