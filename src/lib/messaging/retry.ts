const RETRYABLE_STATUSES = new Set([429, 500, 502, 503, 504])

const DEFAULT_MAX_RETRIES = 3
const DEFAULT_BASE_DELAY = 1000

type RetryOptions = {
  maxRetries?: number
  baseDelay?: number
  onRetry?: (error: unknown, attempt: number, delay: number) => void
}

function isRetryableError(error: unknown): boolean {
  if (error instanceof Response) {
    return RETRYABLE_STATUSES.has(error.status)
  }

  if (error && typeof error === "object" && "status" in error) {
    return RETRYABLE_STATUSES.has((error as { status: number }).status)
  }

  return true
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  options?: RetryOptions,
): Promise<T> {
  const maxRetries = options?.maxRetries ?? DEFAULT_MAX_RETRIES
  const baseDelay = options?.baseDelay ?? DEFAULT_BASE_DELAY

  let lastError: unknown

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error

      if (attempt === maxRetries || !isRetryableError(error)) {
        throw error
      }

      const delay = baseDelay * Math.pow(2, attempt)
      const jitter = Math.random() * 200
      options?.onRetry?.(error, attempt + 1, delay + jitter)
      await sleep(delay + jitter)
    }
  }

  throw lastError
}
