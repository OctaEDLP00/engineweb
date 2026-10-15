import type { ComponentType, Entity, Listener, StoreRecord } from './types/index.js'
import assertComponentShape from './utils/assertComponentShape.js'
import floatsEqual from './utils/floatsEqual.js'

/**
 * Archetype-free entity world over recycled integer ids.
 *
 * Entities are lightweight handles; component data lives in your own SoA
 * stores (see {@link ComponentType}). `registerComponent` instruments
 * `write` so `watch` subscribers and {@link isDirty} flags only react to
 * writes that actually change the stored floats.
 *
 * @example
 * ```typescript
 * const world = new World(1024)
 * world.registerComponent(Position)
 * const player = world.createEntity()
 * world.watch(Position, (entity, value) => syncDot(entity, value))
 * ```
 */
export class World {
  readonly capacity: number

  private readonly alive: Uint8Array
  private readonly freeStack: Int32Array
  private freeCount: number
  private liveEntities = 0
  private readonly stores = new Map<string, StoreRecord>()

  /**
   * Creates the world with a fixed entity budget. Ids are handed out from a
   * free stack, so creation allocates nothing after construction.
   *
   * @param capacity Positive integer entity budget.
   * @throws {RangeError} On non-positive or non-integer capacity.
   */
  constructor(capacity: number) {
    if (!Number.isInteger(capacity) || capacity <= 0) {
      throw new RangeError('capacity must be positive')
    }
    this.capacity = capacity
    this.alive = new Uint8Array(capacity)
    this.freeStack = new Int32Array(capacity)
    for (let i = 0; i < capacity; i++) this.freeStack[i] = capacity - 1 - i
    this.freeCount = capacity
  }

  /** Number of live entities. */
  get entityCount(): number {
    return this.liveEntities
  }

  private assertEntity(entity: Entity): void {
    if (!Number.isInteger(entity) || entity < 0 || entity >= this.capacity) {
      throw new RangeError(`World: entity ${String(entity)} is out of range`)
    }
  }

  private assertAlive(entity: Entity): void {
    this.assertEntity(entity)
    if (this.alive[entity] === 0) {
      throw new Error(`World: entity ${entity} is not alive`)
    }
  }

  private lookup(type: ComponentType<unknown>): StoreRecord {
    assertComponentShape(type)
    const record = this.stores.get(type.name)
    if (!record || record.type !== type) {
      throw new Error(`World: component "${type.name}" is not registered`)
    }
    return record
  }

  /**
   * Creates a new live entity id.
   *
   * @returns Recycled id when available, fresh id otherwise.
   * @throws {Error} When the capacity is exhausted.
   */
  createEntity(): Entity {
    if (this.freeCount <= 0) {
      throw new Error('World: entity capacity exhausted')
    }
    const entity = this.freeStack[--this.freeCount]
    this.alive[entity] = 1
    this.liveEntities++
    return entity
  }

  /**
   * Destroys an entity, clearing its dirty flags and recycling its id for
   * future `createEntity` calls.
   *
   * @param entity Live entity id.
   * @throws {RangeError} On out-of-range ids.
   * @throws {Error} When the entity is not alive.
   */
  destroyEntity(entity: Entity): void {
    this.assertAlive(entity)
    this.alive[entity] = 0
    for (const record of this.stores.values()) record.dirty[entity] = 0
    this.freeStack[this.freeCount++] = entity
    this.liveEntities--
  }

  /**
   * Whether the entity id is currently alive.
   *
   * @param entity Id in `0 <= id < capacity`.
   * @throws {RangeError} On out-of-range ids.
   */
  hasEntity(entity: Entity): boolean {
    this.assertEntity(entity)
    return this.alive[entity] === 1
  }

  /**
   * Registers a component store, allocating its comparison scratch and
   * dirty flags, then wrapping `type.write` with change detection:
   * subscribers fire only when the stored floats actually differ.
   * The same object identity must be used for later `watch` calls.
   *
   * @param type Component descriptor; see {@link ComponentType}.
   * @throws {TypeError} On malformed descriptors.
   * @throws {Error} When a component with the same name is registered.
   */
  registerComponent<T>(type: ComponentType<T>): void {
    assertComponentShape(type as unknown as ComponentType<unknown>)
    if (this.stores.has(type.name)) {
      throw new Error(`World: component "${type.name}" is already registered`)
    }
    const record: StoreRecord = {
      type: type as unknown as ComponentType<unknown>,
      before: new Float32Array(type.arity),
      after: new Float32Array(type.arity),
      dirty: new Uint8Array(this.capacity),
      listeners: new Set(),
      originalWrite: type.write.bind(type) as (entity: Entity, value: unknown) => void,
      originalRead: type.read.bind(type) as (entity: Entity, out: Float32Array) => unknown,
    }
    this.stores.set(type.name, record)
    type.write = ((entity: Entity, value: T): void => {
      this.assertAlive(entity)
      record.originalRead(entity, record.before)
      record.originalWrite(entity, value)
      record.originalRead(entity, record.after)
      if (!floatsEqual(record.before, record.after)) {
        record.dirty[entity] = 1
        for (const listener of record.listeners) listener(entity, value)
      }
    }) as ComponentType<T>['write']
  }

  /**
   * Subscribes to real mutations of a component store (Signal-based).
   *
   * @param type Registered component descriptor (same object identity).
   * @param callback Invoked with `(entity, value)` on each mutating write.
   * @returns Unsubscribe function removing the listener.
   * @throws {TypeError} When the callback is not a function.
   * @throws {Error} When the component is not registered.
   */
  watch<T>(type: ComponentType<T>, callback: (entity: Entity, value: T) => void): () => void {
    if (typeof callback !== 'function') {
      throw new TypeError('World: watch callback must be a function')
    }
    const record = this.lookup(type as unknown as ComponentType<unknown>)
    const listener = callback as unknown as Listener
    record.listeners.add(listener)
    return () => {
      record.listeners.delete(listener)
    }
  }

  /**
   * Whether the entity has an unacknowledged mutation for the component —
   * the pull-style counterpart to {@link watch}.
   *
   * @param type Registered component descriptor.
   * @param entity Live entity id.
   * @throws {Error} When the component is not registered or the entity is dead.
   */
  isDirty<T>(type: ComponentType<T>, entity: Entity): boolean {
    const record = this.lookup(type as unknown as ComponentType<unknown>)
    this.assertAlive(entity)
    return record.dirty[entity] === 1
  }

  /**
   * Acknowledges the pending mutation flag for the entity/component pair.
   *
   * @param type Registered component descriptor.
   * @param entity Live entity id.
   * @throws {Error} When the component is not registered or the entity is dead.
   */
  clearDirty<T>(type: ComponentType<T>, entity: Entity): void {
    const record = this.lookup(type as unknown as ComponentType<unknown>)
    this.assertAlive(entity)
    record.dirty[entity] = 0
  }
}
