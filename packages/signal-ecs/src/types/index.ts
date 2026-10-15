/** Recycled integer entity id in `0 <= id < capacity`. */
export type Entity = number

export interface ComponentType<T> {
  /** Unique store name per world; non-empty string. */
  readonly name: string
  /**
   * Scalars stored per entity; positive integer. `read` must fill at least
   * this many floats into `out`.
   */
  readonly arity: number
  /**
   * Reads component data for an entity from your SoA store into `out`.
   *
   * @param entity Live entity id.
   * @param out Scratch array of length `>= arity` receiving the scalars.
   * @returns The decoded component value.
   */
  read(entity: Entity, out: Float32Array): T
  /**
   * Writes component data for an entity into your SoA store. After
   * {@link World.registerComponent} this is wrapped: listeners fire only
   * when the stored floats actually change.
   *
   * @param entity Live entity id.
   * @param value Value to persist.
   */
  write(entity: Entity, value: T): void
}

/** Mutation subscriber invoked with the entity and the written value. */
export type Listener = (entity: Entity, value: unknown) => void

/** Internal per-component store: comparison scratch, flags and subscribers. */
export interface StoreRecord {
  /** The exact descriptor object passed to `registerComponent`. */
  type: ComponentType<unknown>
  /** Pre-write float snapshot for change detection. */
  before: Float32Array
  /** Post-write float snapshot for change detection. */
  after: Float32Array
  /** Per-entity pending-mutation flags. */
  dirty: Uint8Array
  /** Active `watch` subscribers. */
  listeners: Set<Listener>
  /** Original user `write`, invoked before comparison. */
  originalWrite: (entity: Entity, value: unknown) => void
  /** Original user `read`, used for the before/after snapshots. */
  originalRead: (entity: Entity, out: Float32Array) => unknown
}
