import { randomUUID } from 'node:crypto'
import { config } from './config.js'
import { CircuitBreaker } from './circuit-breaker.js'
import type { SendMessageInput, WhatsAppProvider } from './provider.js'

export type MessageStatus = 'queued' | 'sending' | 'sent' | 'failed'

export type MessageJob = SendMessageInput & {
  id: string
  status: MessageStatus
  attempts: number
  error?: string
  providerMessageId?: string
  createdAt: string
  updatedAt: string
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

export class MessageQueue {
  private jobs = new Map<string, MessageJob>()
  private idempotencyIndex = new Map<string, string>()
  private pending: string[] = []
  private running = false
  private lastSentAt = 0

  constructor(
    private readonly provider: WhatsAppProvider,
    private readonly breaker: CircuitBreaker
  ) {}

  enqueue(input: SendMessageInput) {
    if (input.idempotencyKey) {
      const existingId = this.idempotencyIndex.get(input.idempotencyKey)
      if (existingId) return this.jobs.get(existingId)!
    }
    if (input.to.includes('@g.us')) {
      throw Object.assign(new Error('Group messages are not allowed'), { status: 422 })
    }
    if (this.pending.length >= config.queueMaxSize) {
      throw Object.assign(new Error('Queue is full'), { status: 429 })
    }
    const now = new Date().toISOString()
    const job: MessageJob = {
      ...input,
      id: randomUUID(),
      status: 'queued',
      attempts: 0,
      createdAt: now,
      updatedAt: now,
    }
    this.jobs.set(job.id, job)
    if (job.idempotencyKey) this.idempotencyIndex.set(job.idempotencyKey, job.id)
    this.pending.push(job.id)
    void this.run()
    return job
  }

  get(id: string) {
    return this.jobs.get(id) || null
  }

  stats() {
    return {
      pending: this.pending.length,
      totalTracked: this.jobs.size,
      circuit: this.breaker.state(),
    }
  }

  private async run() {
    if (this.running) return
    this.running = true
    try {
      while (this.pending.length) {
        const id = this.pending.shift()!
        const job = this.jobs.get(id)
        if (!job || job.status === 'sent') continue
        await this.process(job)
      }
    } finally {
      this.running = false
    }
  }

  private async process(job: MessageJob) {
    if (!this.breaker.canCall()) {
      this.fail(job, 'Circuit breaker is open')
      return
    }

    job.status = 'sending'
    job.updatedAt = new Date().toISOString()

    for (let attempt = 1; attempt <= config.retryAttempts; attempt++) {
      job.attempts = attempt
      try {
        await this.waitForPacing()
        const result = await this.provider.sendMessage(job)
        this.lastSentAt = Date.now()
        this.breaker.recordSuccess()
        job.status = 'sent'
        job.providerMessageId = result.providerMessageId
        job.error = undefined
        job.updatedAt = new Date().toISOString()
        console.log(JSON.stringify({ level: 'info', event: 'message.sent', id: job.id, attempts: job.attempts }))
        return
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        job.error = message
        console.error(JSON.stringify({ level: 'warn', event: 'message.send_failed', id: job.id, attempt, error: message }))
        if (attempt < config.retryAttempts) {
          await sleep(config.retryBaseDelayMs * attempt)
        }
      }
    }

    this.breaker.recordFailure()
    this.fail(job, job.error || 'Send failed')
  }

  private fail(job: MessageJob, error: string) {
    job.status = 'failed'
    job.error = error
    job.updatedAt = new Date().toISOString()
    console.error(JSON.stringify({ level: 'error', event: 'message.failed', id: job.id, error }))
  }

  private async waitForPacing() {
    const waitMs = Math.max(0, this.lastSentAt + config.sendMinIntervalMs - Date.now())
    if (waitMs > 0) await sleep(waitMs)
  }
}
