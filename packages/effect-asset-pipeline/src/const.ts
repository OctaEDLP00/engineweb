import type { AssetPipelineOptions, GetKeysOpt } from './types/index.js'

/** First-retry delay in milliseconds; doubled per attempt. */
export const RETRY_BASE_MS = 150
/** Cap for the exponential backoff delay in milliseconds. */
export const RETRY_MAX_MS = 5000

/** Constructor defaults applied when an option is omitted. */
export const DEFAULT_OPTIONS = {
  /** Soft byte budget: 256 MiB of cached assets. */
  cacheBudgetBytes: 256 * 1024 * 1024,
  /** Retries after the first attempt. */
  maxRetries: 3,
  /** Simultaneous fetches. */
  concurrency: 6,
} satisfies GetKeysOpt<AssetPipelineOptions, number>
