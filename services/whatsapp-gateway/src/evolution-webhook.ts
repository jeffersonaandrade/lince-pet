export type WebhookDecision = {
  accepted: boolean
  reason?: string
  remoteJid?: string
  messageId?: string
}

const findRemoteJid = (body: unknown): string | undefined => {
  const value = body as Record<string, unknown>
  const data = value?.data as Record<string, unknown> | undefined
  const key = data?.key as Record<string, unknown> | undefined
  return typeof key?.remoteJid === 'string' ? key.remoteJid : undefined
}

const findMessageId = (body: unknown): string | undefined => {
  const value = body as Record<string, unknown>
  const data = value?.data as Record<string, unknown> | undefined
  const key = data?.key as Record<string, unknown> | undefined
  return typeof key?.id === 'string' ? key.id : undefined
}

export function classifyEvolutionMessage(body: unknown): WebhookDecision {
  const remoteJid = findRemoteJid(body)
  const messageId = findMessageId(body)
  if (!remoteJid) return { accepted: false, reason: 'missing_remote_jid', messageId }
  if (remoteJid.endsWith('@g.us')) return { accepted: false, reason: 'group_message_ignored', remoteJid, messageId }
  return { accepted: true, remoteJid, messageId }
}
