import type { AssetPipelineOptions, AssetRequest, CacheEntry } from './types/index.js'
import { DEFAULT_OPTIONS, RETRY_BASE_MS, RETRY_MAX_MS } from './const.js'
import abortError from './utils/abortError.js'
import sleep from './utils/sleep.js'

/**
 * Resilient asset loader and GPU-memory cache: bounded-concurrency queue,
 * exponential-backoff retries, LRU byte budget and in-flight dedup.
 *
 * Repeat loads resolve from memory (shared buffers — treat as read-only);
 * concurrent loads of one URL share a single fetch.
 *
 * @example
 * ```typescript
 * const assets = new AssetPipeline({ concurrency: 6 })
 * const bytes = await assets.load({ url: '/tex/arena.ktx2', kind: 'texture' })
 * uploadToGpu(bytes)
 * assets.purge()
 * ```
 */
export class AssetPipeline {
  readonly concurrency: number
  readonly maxRetries: number
  readonly cacheBudgetBytes: number

  private activeLoads = 0
  private readonly waiters: Array<() => void> = []
  private readonly cache = new Map<string, CacheEntry>()
  private readonly inFlight = new Map<string, Promise<ArrayBuffer>>()
  private cachedBytes = 0
  private useSequence = 0

  /**
   * Creates a pipeline, filling omitted options from {@link DEFAULT_OPTIONS}.
   *
   * @param options Budgets; see {@link AssetPipelineOptions}.
   * @throws {RangeError} On non-positive integer `concurrency`, negative
   * integer `maxRetries`, or negative `cacheBudgetBytes`.
   */
  constructor(options: AssetPipelineOptions = {}) {
    const concurrency = options.concurrency ?? DEFAULT_OPTIONS['concurrency']
    const maxRetries = options.maxRetries ?? DEFAULT_OPTIONS['maxRetries']
    const cacheBudgetBytes = options.cacheBudgetBytes ?? DEFAULT_OPTIONS['cacheBudgetBytes']
    if (!Number.isInteger(concurrency) || concurrency <= 0) {
      throw new RangeError('concurrency must be a positive integer')
    }
    if (!Number.isInteger(maxRetries) || maxRetries < 0) {
      throw new RangeError('maxRetries must be a non-negative integer')
    }
    if (!Number.isFinite(cacheBudgetBytes) || cacheBudgetBytes < 0) {
      throw new RangeError('cacheBudgetBytes must be >= 0')
    }
    this.concurrency = concurrency
    this.maxRetries = maxRetries
    this.cacheBudgetBytes = cacheBudgetBytes
  }

  /** Bytes currently held by the cache. */
  get cachedByteCount(): number {
    return this.cachedBytes
  }

  /** Entries currently held by the cache. */
  get cachedEntryCount(): number {
    return this.cache.size
  }

  /**
   * Queues an asset download behind the concurrency semaphore: cache hits
   * and in-flight duplicates resolve without fetching, misses fetch with
   * retries, then store under the LRU budget.
   *
   * @param request URL, kind and optional signal; see {@link AssetRequest}.
   * @returns Shared `ArrayBuffer` (read-only); rejects with the last fetch
   * error after retries, or immediately on abort.
   * @throws {TypeError} Synchronously when `request.url` is missing.
   */
  load(request: AssetRequest): Promise<ArrayBuffer> {
    if (!request || typeof request !== 'object') {
      throw new TypeError('load expects an { url, kind } asset request')
    }
    if (
      request.url === undefined ||
      request.url === null ||
      request.url === '' ||
      (typeof request.url !== 'string' && !(request.url instanceof URL))
    ) {
      throw new TypeError('request.url is required')
    }
    const key = String(request.url)
    const hit = this.cache.get(key)
    if (hit) {
      hit.lastUsed = ++this.useSequence
      return Promise.resolve(hit.data)
    }
    const existing = this.inFlight.get(key)
    if (existing) return existing
    const task = this.execute(key, request)
    this.inFlight.set(key, task)
    const cleanup = (): void => {
      if (this.inFlight.get(key) === task) this.inFlight.delete(key)
    }
    task.then(cleanup, cleanup)
    return task
  }

  /**
   * Purges least-recently-used entries until the cache fits the budget.
   * No-op when already within budget.
   */
  purge(): void {
    while (this.cachedBytes > this.cacheBudgetBytes && this.cache.size > 0) {
      this.evictOldest()
    }
  }

  /** Empties the cache unconditionally, resetting byte telemetry to zero. */
  clear(): void {
    this.cache.clear()
    this.cachedBytes = 0
  }

  private async execute(key: string, request: AssetRequest): Promise<ArrayBuffer> {
    await this.acquire(request.signal)
    try {
      const data = await this.fetchWithRetry(key, request)
      this.store(key, data)
      return data
    } finally {
      this.release()
    }
  }

  private acquire(signal?: AbortSignal): Promise<void> {
    if (signal?.aborted) return Promise.reject(abortError(signal))
    if (this.activeLoads < this.concurrency) {
      this.activeLoads++
      return Promise.resolve()
    }
    return new Promise<void>((resolve, reject) => {
      const grant = (): void => {
        signal?.removeEventListener('abort', onAbort)
        this.activeLoads++
        resolve()
      }
      const onAbort = (): void => {
        const index = this.waiters.indexOf(grant)
        if (index !== -1) this.waiters.splice(index, 1)
        reject(abortError(signal))
      }
      this.waiters.push(grant)
      signal?.addEventListener('abort', onAbort, { once: true })
    })
  }

  private release(): void {
    this.activeLoads--
    const next = this.waiters.shift()
    if (next) next()
    if (this.activeLoads < 0) this.activeLoads = 0
  }

  private async fetchWithRetry(key: string, request: AssetRequest): Promise<ArrayBuffer> {
    let attempt = 0
    for (;;) {
      request.signal?.throwIfAborted()
      try {
        const response = await fetch(key, { signal: request.signal })
        if (!response.ok) {
          throw new Error(`AssetPipeline: fetch failed for ${key} (HTTP ${response.status})`)
        }
        return await response.arrayBuffer()
      } catch (error) {
        if ((error as Error | undefined)?.name === 'AbortError') throw error
        if (attempt >= this.maxRetries) throw error
        const delay = Math.min(RETRY_MAX_MS, RETRY_BASE_MS * 2 ** attempt) + Math.random() * 100
        attempt++
        await sleep(delay, request.signal)
      }
    }
  }

  private store(key: string, data: ArrayBuffer): void {
    const previous = this.cache.get(key)
    if (previous) {
      this.cachedBytes -= previous.bytes
      this.cache.delete(key)
    }
    while (this.cachedBytes + data.byteLength > this.cacheBudgetBytes && this.cache.size > 0) {
      this.evictOldest()
    }
    this.cache.set(key, { data, bytes: data.byteLength, lastUsed: ++this.useSequence })
    this.cachedBytes += data.byteLength
  }

  private evictOldest(): void {
    let oldestKey: string | null = null
    let oldestUse = Infinity
    for (const [key, entry] of this.cache) {
      if (entry.lastUsed < oldestUse) {
        oldestUse = entry.lastUsed
        oldestKey = key
      }
    }
    if (oldestKey === null) return
    const entry = this.cache.get(oldestKey)
    if (entry) {
      this.cachedBytes -= entry.bytes
      if (this.cachedBytes < 0) this.cachedBytes = 0
    }
    this.cache.delete(oldestKey)
  }
}
