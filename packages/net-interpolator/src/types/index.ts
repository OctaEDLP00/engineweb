export interface Snapshot<T> {
  /** Snapshot payload: number, numeric array, or plain object with numeric fields. */
  state: T
  /** Server timestamp in milliseconds; must be finite and `>= 0`. */
  timestamp: number
}

export interface InterpolatorOptions {
  /**
   * Target interpolation delay in milliseconds (the "render delay"
   * subtracted from local time). Must be finite and `>= 0`.
   */
  delayMs: number
  /**
   * Maximum snapshots kept in the jitter buffer; oldest evicted first.
   * Positive integer, defaults to `32`.
   */
  bufferSize?: number
}
