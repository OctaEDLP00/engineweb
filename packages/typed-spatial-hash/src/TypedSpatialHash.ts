import { HASH_MULT_X, HASH_MULT_Y, NO_BUCKET, NO_ENTITY } from './const.js'
import type { QueryResult, SpatialHashOptions } from './types/index.js'
import nextPowerOfTwo from './utils/nextPowerOfTwo.js'
import quickSelect from './utils/quickSelect.js'

/**
 * Zero-GC uniform-grid spatial hash over flat typed arrays.
 *
 * Positions live in `Float32Array`s, bucket membership in intrusive linked
 * lists, and both queries reuse preallocated scratch buffers, so steady-state
 * usage allocates nothing. Query results share one reused
 * {@link QueryResult} object — copy `ids` out if you keep it.
 *
 * @example
 * ```typescript
 * import { TypedSpatialHash } from '@engineweb/typed-spatial-hash'
 *
 * const grid = new TypedSpatialHash({ cellSize: 16, capacity: 5000 })
 * grid.insert(playerId, playerX, playerY)
 * const nearby = grid.queryRadius(playerX, playerY, 48)
 * for (let i = 0; i < nearby.count; i++) collide(playerId, nearby.ids[i])
 * ```
 */
export class TypedSpatialHash {
  readonly cellSize: number
  readonly capacity: number

  private readonly posX: Float32Array
  private readonly posY: Float32Array
  private readonly alive: Uint8Array
  private readonly bucketOf: Int32Array
  private readonly head: Int32Array
  private readonly next: Int32Array
  private readonly stamp: Int32Array
  private readonly mask: number
  private querySequence = 0
  private aliveCount = 0

  private readonly scratchIds: Uint32Array
  private readonly scratchDist: Float64Array
  private readonly result: QueryResult

  /**
   * Creates an empty index. All buffers are preallocated here; runtime
   * operations allocate nothing.
   *
   * @param options Grid sizing; see {@link SpatialHashOptions}.
   * @throws {TypeError} When `cellSize`/`capacity` are not numbers.
   * @throws {RangeError} When `cellSize` is not finite positive or `capacity`
   * is not a positive integer.
   */
  constructor(options: SpatialHashOptions) {
    if (!options || typeof options.cellSize !== 'number' || typeof options.capacity !== 'number') {
      throw new TypeError('TypedSpatialHash expects { cellSize, capacity } numbers')
    }
    if (!(options.cellSize > 0) || !Number.isFinite(options.cellSize)) {
      throw new RangeError('cellSize and capacity must be positive')
    }
    if (!Number.isInteger(options.capacity) || options.capacity <= 0) {
      throw new RangeError('cellSize and capacity must be positive')
    }
    this.cellSize = options.cellSize
    this.capacity = options.capacity

    const tableSize = nextPowerOfTwo(options.capacity * 2)
    this.mask = tableSize - 1
    this.posX = new Float32Array(options.capacity)
    this.posY = new Float32Array(options.capacity)
    this.alive = new Uint8Array(options.capacity)
    this.bucketOf = new Int32Array(options.capacity).fill(NO_BUCKET)
    this.head = new Int32Array(tableSize).fill(NO_ENTITY)
    this.next = new Int32Array(options.capacity).fill(NO_ENTITY)
    this.stamp = new Int32Array(options.capacity)
    this.scratchIds = new Uint32Array(options.capacity)
    this.scratchDist = new Float64Array(options.capacity)
    this.result = { ids: this.scratchIds, count: 0 }
  }

  /** Number of entities currently stored. */
  get size(): number {
    return this.aliveCount
  }

  private bucketFor(cellX: number, cellY: number): number {
    return (Math.imul(cellX, HASH_MULT_X) ^ Math.imul(cellY, HASH_MULT_Y)) & this.mask
  }

  private assertId(id: number): void {
    if (!Number.isInteger(id) || id < 0 || id >= this.capacity) {
      throw new RangeError('invalid entity id or position')
    }
  }

  private unlink(id: number): void {
    const bucket = this.bucketOf[id]
    if (bucket === NO_BUCKET) return
    let prev = NO_ENTITY
    let current = this.head[bucket]
    while (current !== NO_ENTITY) {
      if (current === id) {
        if (prev === NO_ENTITY) this.head[bucket] = this.next[current]
        else this.next[prev] = this.next[current]
        this.next[current] = NO_ENTITY
        this.bucketOf[current] = NO_BUCKET
        return
      }
      prev = current
      current = this.next[current]
    }
  }

  /**
   * Inserts a new entity or moves an existing one between cells.
   * Allocates nothing.
   *
   * @param id Entity id in `0 <= id < capacity`.
   * @param x World X position (finite).
   * @param y World Y position (finite).
   * @throws {RangeError} On out-of-range ids or non-finite coordinates.
   */
  insert(id: number, x: number, y: number): void {
    this.assertId(id)
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      throw new RangeError('invalid entity id or position')
    }
    const bucket = this.bucketFor(Math.floor(x / this.cellSize), Math.floor(y / this.cellSize))
    if (this.alive[id] === 1) this.unlink(id)
    else {
      this.alive[id] = 1
      this.aliveCount++
    }
    this.posX[id] = x
    this.posY[id] = y
    this.next[id] = this.head[bucket]
    this.head[bucket] = id
    this.bucketOf[id] = bucket
  }

  /**
   * Removes an entity from the index. No-op when the id is not stored.
   * Allocates nothing.
   *
   * @param id Entity id in `0 <= id < capacity`.
   * @throws {RangeError} On out-of-range ids.
   */
  remove(id: number): void {
    this.assertId(id)
    if (this.alive[id] === 0) return
    this.unlink(id)
    this.alive[id] = 0
    this.aliveCount--
  }

  /**
   * Removes every entity, resetting buckets, links and liveness flags.
   * Allocates nothing.
   */
  clear(): void {
    this.head.fill(NO_ENTITY)
    this.next.fill(NO_ENTITY)
    this.bucketOf.fill(NO_BUCKET)
    this.alive.fill(0)
    this.aliveCount = 0
  }

  /**
   * Whether the id is currently stored.
   *
   * @param id Entity id in `0 <= id < capacity`.
   * @returns `true` after {@link insert} until {@link remove} or {@link clear}.
   * @throws {RangeError} On out-of-range ids.
   */
  has(id: number): boolean {
    this.assertId(id)
    return this.alive[id] === 1
  }

  /**
   * Broad-phase radius query over every cell overlapping the circle.
   * Hash-collision visits are deduplicated with a stamp array, so each
   * entity is distance-tested once. Results are unsorted.
   *
   * @param x Circle center X (finite).
   * @param y Circle center Y (finite).
   * @param radius Search radius, `>= 0` (`0` matches the exact point).
   * @returns The reused {@link QueryResult} — copy `ids` if you keep it.
   * @throws {RangeError} On non-finite positions or negative radius.
   */
  queryRadius(x: number, y: number, radius: number): QueryResult {
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      throw new RangeError('query position must be finite numbers')
    }
    if (!Number.isFinite(radius) || radius < 0) {
      throw new RangeError('radius must be >= 0')
    }
    this.querySequence++
    const sequence = this.querySequence
    const radius2 = radius * radius
    const inverse = 1 / this.cellSize
    const minCellX = Math.floor((x - radius) * inverse)
    const maxCellX = Math.floor((x + radius) * inverse)
    const minCellY = Math.floor((y - radius) * inverse)
    const maxCellY = Math.floor((y + radius) * inverse)
    let count = 0
    for (let cellX = minCellX; cellX <= maxCellX; cellX++) {
      for (let cellY = minCellY; cellY <= maxCellY; cellY++) {
        let entity = this.head[this.bucketFor(cellX, cellY)]
        while (entity !== NO_ENTITY) {
          const current = entity
          entity = this.next[entity]
          if (this.stamp[current] === sequence) continue
          this.stamp[current] = sequence
          const dx = this.posX[current] - x
          const dy = this.posY[current] - y
          if (dx * dx + dy * dy <= radius2 && count < this.capacity) {
            this.scratchIds[count++] = current
          }
        }
      }
    }
    this.result.count = count
    return this.result
  }

  /**
   * k-nearest-neighbor query: gathers alive entities into scratch buffers,
   * quickselects the closest `k`, then insertion-sorts that prefix
   * ascending by squared distance.
   *
   * @param x Query X (finite).
   * @param y Query Y (finite).
   * @param k How many neighbors to take; clamped to the stored count.
   * @returns The reused {@link QueryResult} with the nearest ids first.
   * @throws {RangeError} On non-finite positions or non-positive `k`.
   */
  queryKNearest(x: number, y: number, k: number): QueryResult {
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      throw new RangeError('query position must be finite numbers')
    }
    if (!Number.isInteger(k) || k <= 0) {
      throw new RangeError('k must be positive')
    }
    let gathered = 0
    for (let id = 0; id < this.capacity; id++) {
      if (this.alive[id] === 0) continue
      const dx = this.posX[id] - x
      const dy = this.posY[id] - y
      this.scratchIds[gathered] = id
      this.scratchDist[gathered] = dx * dx + dy * dy
      gathered++
    }
    const take = Math.min(k, gathered)
    if (take === 0) {
      this.result.count = 0
      return this.result
    }
    quickSelect(this.scratchIds, this.scratchDist, 0, gathered - 1, take - 1)
    for (let i = 1; i < take; i++) {
      const id = this.scratchIds[i]
      const d = this.scratchDist[i]
      let j = i - 1
      while (j >= 0 && this.scratchDist[j] > d) {
        this.scratchIds[j + 1] = this.scratchIds[j]
        this.scratchDist[j + 1] = this.scratchDist[j]
        j--
      }
      this.scratchIds[j + 1] = id
      this.scratchDist[j + 1] = d
    }
    this.result.count = take
    return this.result
  }
}
