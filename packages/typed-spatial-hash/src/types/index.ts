export interface SpatialHashOptions {
  /**
   * Uniform cell edge in world units. Must be a finite number `> 0`.
   * Pick roughly the diameter of a typical entity so buckets stay short.
   */
  cellSize: number
  /**
   * Maximum entity count. Must be a positive integer; valid ids satisfy
   * `0 <= id < capacity`.
   */
  capacity: number
}

export interface QueryResult {
  /**
   * Entity ids matching the query. This buffer is reused across queries —
   * copy it out if you need to keep it past the next query.
   */
  ids: Uint32Array
  /** Number of valid entries in `ids`. */
  count: number
}
