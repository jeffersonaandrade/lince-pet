export type ProviderName = 'log' | 'evolution'

const readInt = (key: string, fallback: number) => {
  const raw = process.env[key]
  if (!raw) return fallback
  const value = Number(raw)
  return Number.isFinite(value) && value > 0 ? value : fallback
}

export const config = {
  port: readInt('PORT', 3333),
  gatewayToken: process.env.GATEWAY_TOKEN || '',
  provider: (process.env.WHATSAPP_PROVIDER || 'log') as ProviderName,
  evolution: {
    baseUrl: (process.env.EVOLUTION_BASE_URL || '').replace(/\/+$/, ''),
    apiKey: process.env.EVOLUTION_API_KEY || '',
    instanceName: process.env.EVOLUTION_INSTANCE_NAME || '',
  },
  sendTimeoutMs: readInt('SEND_TIMEOUT_MS', 10_000),
  retryAttempts: readInt('RETRY_ATTEMPTS', 3),
  retryBaseDelayMs: readInt('RETRY_BASE_DELAY_MS', 750),
  sendMinIntervalMs: readInt('SEND_MIN_INTERVAL_MS', 2500),
  queueMaxSize: readInt('QUEUE_MAX_SIZE', 1000),
  circuitFailureThreshold: readInt('CIRCUIT_FAILURE_THRESHOLD', 5),
  circuitOpenMs: readInt('CIRCUIT_OPEN_MS', 60_000),
  autoReplyText: process.env.AUTO_REPLY_TEXT || '',
  autoReplyCooldownMs: readInt('AUTO_REPLY_COOLDOWN_MS', 86_400_000),
}

export function validateConfig() {
  const errors: string[] = []
  if (!config.gatewayToken) errors.push('GATEWAY_TOKEN is required')
  if (!['log', 'evolution'].includes(config.provider)) errors.push('WHATSAPP_PROVIDER must be log or evolution')
  if (config.provider === 'evolution') {
    if (!config.evolution.baseUrl) errors.push('EVOLUTION_BASE_URL is required')
    if (!config.evolution.apiKey) errors.push('EVOLUTION_API_KEY is required')
    if (!config.evolution.instanceName) errors.push('EVOLUTION_INSTANCE_NAME is required')
  }
  return errors
}
