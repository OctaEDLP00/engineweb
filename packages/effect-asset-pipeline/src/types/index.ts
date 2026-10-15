/** Asset category. Informational today; reserved for kind-aware budgets. */
export type AssetKind = 'texture' | 'model' | 'audio' | 'sprite-sheet' | 'binary'

export interface AssetRequest {
  /** Asset URL; `String(url)` is the cache key. Required, non-empty. */
  url: string | URL
  /** Asset category. */
  kind: AssetKind
  /**
   * Optional priority (higher = downloaded first). Accepted, currently
   * advisory — reserved for priority scheduling.
   */
  priority?: number
  /** Optional abort signal; aborts queue wait, fetch and retry sleeps. */
  signal?: AbortSignal
}

/** Internal cache slot: shared buffer plus LRU bookkeeping. */
export interface CacheEntry {
  /** Downloaded bytes; shared by reference, treat as read-only. */
  data: ArrayBuffer
  /** `data.byteLength` at store time. */
  bytes: number
  /** Monotonic use counter for LRU ordering. */
  lastUsed: number
}

export interface AssetPipelineOptions {
  /**
   * Maximum number of concurrent downloads. Positive integer,
   * defaults to `6`.
   */
  concurrency?: number
  /**
   * Retries after the first attempt, with exponential backoff and jitter.
   * Non-negative integer, defaults to `3`.
   */
  maxRetries?: number
  /**
   * Soft budget for cached bytes; LRU entries evict past it.
   * Non-negative finite number, defaults to 256 MiB.
   */
  cacheBudgetBytes?: number
}

/** Maps every key of an options object to one value type (used for defaults). */
export type GetKeysOpt<Key extends object, Type extends number> = { [K in keyof Key]: Type }
