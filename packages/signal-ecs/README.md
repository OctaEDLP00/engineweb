# `@engineweb/signal-ecs`

An ultra-lightweight Entity Component System driven by **signals over Structure-of-Arrays (SoA)** data.

Component stores live in `TypedArrays`; writes are change-detected, so subscribers and renderers only react to components whose values actually mutated — ideal for hybrid DOM + WebGL loops without full re-renders.

## Features

- Recycled integer entity ids with a fixed `capacity` (no id growth, no GC churn).
- `registerComponent` instruments `write`: before/after float comparison decides whether listeners fire.
- Per-entity dirty flags (`isDirty`/`clearDirty`) for pull-style renderers.
- Unsubscribe handles from `watch`; entities fully recyclable via `destroyEntity`.

## Installation

```bash
pnpm add @engineweb/signal-ecs
```

## Usage

```typescript
import { World, type ComponentType, type Entity } from '@engineweb/signal-ecs'

const CAPACITY = 1024
const store = new Float32Array(CAPACITY * 2) // SoA backing: [x0, y0, x1, y1, ...]

interface XY { x: number; y: number }

const Position: ComponentType<XY> = {
  name: 'position',
  arity: 2,
  read(entity: Entity, out: Float32Array): XY {
    out[0] = store[entity * 2]
    out[1] = store[entity * 2 + 1]
    return { x: out[0], y: out[1] }
  },
  write(entity: Entity, value: XY): void {
    store[entity * 2] = value.x
    store[entity * 2 + 1] = value.y
  },
}

const world = new World(CAPACITY)
world.registerComponent(Position)

// Reactive binding: sync a DOM dot only when the value really changed
const player = world.createEntity()
world.watch(Position, (entity, value) => {
  document.getElementById(`dot-${entity}`)?.setAttribute('cx', String(value.x))
})

Position.write(player, { x: 10, y: 20 }) // fires
Position.write(player, { x: 10, y: 20 }) // silent — floats are identical

// Pull-style: drain dirty flags in the render loop
if (world.isDirty(Position, player)) {
  syncCanvas(player)
  world.clearDirty(Position, player)
}

world.destroyEntity(player) // id recycled by the next createEntity()
```

## API

### `new World(capacity: number)`

Positive-integer entity budget. Throws `RangeError` otherwise.

### `ComponentType<T>`

```typescript
interface ComponentType<T> {
  readonly name: string // unique per world
  readonly arity: number // scalars per entity; positive integer
  read(entity: Entity, out: Float32Array): T // fill `out` (length >= arity) from your SoA store
  write(entity: Entity, value: T): void // persist `value` into your SoA store
}
```

`registerComponent` replaces `write` with an instrumented wrapper (change detection + notification). Don't reassign `write` afterwards, and don't pass frozen component objects.

### Methods

| Method | Description |
|---|---|
| `createEntity(): Entity` | Next recycled id. Throws when capacity is exhausted. |
| `destroyEntity(entity)` | Kills the entity, clears its dirty flags, recycles the id. |
| `hasEntity(entity)` | Liveness check. |
| `get entityCount()` | Live entity count. |
| `registerComponent(type)` | Registers a store; throws on duplicates or malformed descriptors. |
| `watch(type, cb): () => void` | Subscribes to real mutations; returns an unsubscribe function. |
| `isDirty(type, entity)` | Pending-mutation flag for pull renderers. |
| `clearDirty(type, entity)` | Acknowledges the flag. |

Change comparison uses `Object.is` per scalar, so `NaN` writes are correctly treated as no-ops and `-0` vs `+0` as changes.

## License

MIT
