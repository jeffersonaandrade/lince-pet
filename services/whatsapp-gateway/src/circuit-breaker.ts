import { config } from './config.js'

export class CircuitBreaker {
  private failures = 0
  private openedUntil = 0

  canCall() {
    return Date.now() >= this.openedUntil
  }

  state() {
    if (!this.canCall()) return 'open'
    return this.failures > 0 ? 'degraded' : 'closed'
  }

  recordSuccess() {
    this.failures = 0
    this.openedUntil = 0
  }

  recordFailure() {
    this.failures += 1
    if (this.failures >= config.circuitFailureThreshold) {
      this.openedUntil = Date.now() + config.circuitOpenMs
    }
  }
}
