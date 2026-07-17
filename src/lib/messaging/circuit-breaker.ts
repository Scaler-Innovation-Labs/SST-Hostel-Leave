type CircuitState = "CLOSED" | "OPEN" | "HALF_OPEN"

type CircuitBreakerOptions = {
  failureThreshold: number
  cooldownMs: number
  halfOpenMaxRequests?: number
  onStateChange?: (from: CircuitState, to: CircuitState) => void
}

type CircuitEntry = {
  failureCount: number
  halfOpenRequests: number
  halfOpenSent: number
  state: CircuitState
  lastFailureTime: number
  lastStateChange: number
}

const store = new Map<string, CircuitEntry>()

const DEFAULT_OPTIONS: Required<CircuitBreakerOptions> = {
  failureThreshold: 5,
  cooldownMs: 30_000,
  halfOpenMaxRequests: 1,
  onStateChange: () => {},
}

export function getCircuitBreaker(
  key: string,
  options?: Partial<CircuitBreakerOptions>,
) {
  const opts = { ...DEFAULT_OPTIONS, ...options }

  function getEntry(): CircuitEntry {
    let entry = store.get(key)
    if (!entry) {
      entry = {
        failureCount: 0,
        halfOpenRequests: 0,
        halfOpenSent: 0,
        state: "CLOSED",
        lastFailureTime: 0,
        lastStateChange: 0,
      }
      store.set(key, entry)
    }
    return entry
  }

  function updateState(entry: CircuitEntry, newState: CircuitState): void {
    if (entry.state !== newState) {
      opts.onStateChange(entry.state, newState)
    }
    entry.state = newState
    entry.lastStateChange = Date.now()
  }

  async function call<T>(fn: () => Promise<T>): Promise<T> {
    const entry = getEntry()
    const now = Date.now()

    if (entry.state === "OPEN") {
      if (now - entry.lastStateChange >= opts.cooldownMs) {
        updateState(entry, "HALF_OPEN")
        entry.halfOpenRequests = 0
        entry.halfOpenSent = 0
      } else {
        throw new CircuitBreakerOpenError(key)
      }
    }

    if (entry.state === "HALF_OPEN") {
      if (entry.halfOpenSent >= opts.halfOpenMaxRequests) {
        throw new CircuitBreakerOpenError(key, "Circuit is half-open, waiting for probe result")
      }
      entry.halfOpenSent++
    }

    try {
      const result = await fn()

      if (entry.state === "HALF_OPEN") {
        updateState(entry, "CLOSED")
        entry.failureCount = 0
        entry.halfOpenRequests = 0
      }

      return result
    } catch (error) {
      entry.lastFailureTime = now

      if (entry.state === "HALF_OPEN") {
        updateState(entry, "OPEN")
        return Promise.reject(error)
      }

      entry.failureCount++

      if (entry.failureCount >= opts.failureThreshold) {
        updateState(entry, "OPEN")
      }

      return Promise.reject(error)
    }
  }

  function getState(): { state: CircuitState; failureCount: number } {
    const entry = getEntry()
    return { state: entry.state, failureCount: entry.failureCount }
  }

  function reset(): void {
    store.delete(key)
  }

  return { call, getState, reset }
}

export class CircuitBreakerOpenError extends Error {
  constructor(
    public readonly key: string,
    message = "Circuit breaker is open",
  ) {
    super(message)
    this.name = "CircuitBreakerOpenError"
  }
}
