import http from 'node:http'
import { config, validateConfig } from './config.js'
import { CircuitBreaker } from './circuit-breaker.js'
import { EvolutionProvider } from './evolution-provider.js'
import { LogProvider } from './provider.js'
import type { SendMessageInput, WhatsAppProvider } from './provider.js'
import { MessageQueue } from './queue.js'
import { classifyEvolutionMessage } from './evolution-webhook.js'

const provider: WhatsAppProvider = config.provider === 'evolution' ? new EvolutionProvider() : new LogProvider()
const breaker = new CircuitBreaker()
const queue = new MessageQueue(provider, breaker)
const startupErrors = validateConfig()

function send(res: http.ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' })
  res.end(JSON.stringify(body))
}

async function readJson(req: http.IncomingMessage) {
  const chunks: Buffer[] = []
  for await (const chunk of req) chunks.push(Buffer.from(chunk))
  const raw = Buffer.concat(chunks).toString('utf8')
  return raw ? JSON.parse(raw) : {}
}

function authorized(req: http.IncomingMessage, url: URL) {
  return req.headers['x-gateway-token'] === config.gatewayToken || url.searchParams.get('token') === config.gatewayToken
}

function validateMessage(body: Record<string, unknown>): SendMessageInput {
  const to = typeof body.to === 'string' ? body.to.trim() : ''
  const text = typeof body.text === 'string' ? body.text.trim() : ''
  const idempotencyKey = typeof body.idempotencyKey === 'string' ? body.idempotencyKey.trim() : undefined
  if (!to) throw Object.assign(new Error('to is required'), { status: 422 })
  if (!text) throw Object.assign(new Error('text is required'), { status: 422 })
  if (text.length > 2000) throw Object.assign(new Error('text is too long'), { status: 422 })
  return { to, text, idempotencyKey }
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`)

    if (req.method === 'GET' && url.pathname === '/health/live') {
      send(res, 200, { ok: true })
      return
    }

    if (!authorized(req, url)) {
      send(res, 401, { ok: false, error: 'unauthorized' })
      return
    }

    if (req.method === 'GET' && url.pathname === '/health/ready') {
      send(res, startupErrors.length ? 503 : 200, {
        ok: startupErrors.length === 0,
        errors: startupErrors,
        provider: provider.name,
        queue: queue.stats(),
      })
      return
    }

    if (req.method === 'GET' && url.pathname === '/provider/status') {
      send(res, 200, await provider.status())
      return
    }

    if (req.method === 'POST' && url.pathname === '/messages') {
      if (startupErrors.length) {
        send(res, 503, { ok: false, errors: startupErrors })
        return
      }
      const job = queue.enqueue(validateMessage((await readJson(req)) as Record<string, unknown>))
      send(res, 202, { id: job.id, status: job.status, attempts: job.attempts })
      return
    }

    if (req.method === 'POST' && url.pathname === '/webhooks/evolution/messages-upsert') {
      const decision = classifyEvolutionMessage(await readJson(req))
      if (decision.accepted && decision.remoteJid && config.autoReplyText) {
        const job = queue.enqueue({
          to: decision.remoteJid,
          text: config.autoReplyText,
          idempotencyKey: `autoreply:${decision.messageId || decision.remoteJid}`,
        })
        Object.assign(decision, { replyJobId: job.id })
      }
      console.log(JSON.stringify({ level: 'info', event: 'webhook.evolution.messages_upsert', ...decision }))
      send(res, 200, decision)
      return
    }

    const match = url.pathname.match(/^\/messages\/([^/]+)$/)
    if (req.method === 'GET' && match) {
      const job = queue.get(match[1])
      send(res, job ? 200 : 404, job || { ok: false, error: 'not found' })
      return
    }

    send(res, 404, { ok: false, error: 'not found' })
  } catch (error) {
    const status = typeof (error as { status?: unknown }).status === 'number' ? (error as { status: number }).status : 500
    send(res, status, { ok: false, error: error instanceof Error ? error.message : String(error) })
  }
})

server.listen(config.port, () => {
  console.log(JSON.stringify({ level: 'info', event: 'gateway.started', port: config.port, provider: provider.name }))
})
