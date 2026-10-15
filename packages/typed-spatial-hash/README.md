# `@engineweb/typed-spatial-hash`

High-performance spatial partitioning (uniform spatial hash) built exclusively on **TypedArrays** — no heap objects on the hot path, no Garbage Collection pauses, even with 5,000+ simultaneous entities.

Ideal for broad-phase collision detection, radius searches and k-nearest-neighbor queries in tight game loops.

## Features

- `Float32Array` positions, `Uint8Array` liveness flags, power-of-two bucket table with intrusive linked lists.
- **Zero allocation at runtime**: `insert`, `remove` and both queries reuse preallocated buffers.
- Radius queries deduplicate hash-collision visits with a stamp array, so each entity is tested once.
- k-NN uses in-place quickselect + insertion sort over scratch buffers.

## Installation

```bash
pnpm add @engineweb/typed-spatial-hash
```

## Usage

```typescript
import { TypedSpatialHash } from '@engineweb/typed-spatial-hash'

const grid = new TypedSpatialHash({ cellSize: 16, capacity: 5000 })

// Insert or move entities (ids are 0 .. capacity - 1)
grid.insert(playerId, playerX, playerY)
grid.insert(npcId, npcX, npcY)

// Broad-phase: who is within 48 units of the player?
const nearby = grid.queryRadius(playerX, playerY, 48)
for (let i = 0; i < nearby.count; i++) {
  collide(playerId, nearby.ids[i])
}

// 4 nearest neighbors for AI targeting
const nearest = grid.queryKNearest(npcX, npcY, 4)

grid.remove(deadId)
```

> **Reused buffers.** Both queries return the same internal `{ ids, count }` object backed by a preallocated `Uint32Array`. Copy the ids out if you need to keep them past the next query:
>
> ```typescript
> const snapshot = nearby.ids.slice(0, nearby.count)
> ```

## API

### `new TypedSpatialHash(options: SpatialHashOptions)`

| Option | Description |
|---|---|
| `cellSize` | Uniform cell edge in world units. Must be positive. Pick roughly the diameter of a typical entity. |
| `capacity` | Maximum entity count. Must be a positive integer. Ids must satisfy `0 <= id < capacity`. |

### Methods

| Method | Description |
|---|---|
| `insert(id, x, y)` | Inserts or updates an entity position. Allocates nothing. Throws `RangeError` on out-of-range ids or non-finite coordinates. |
| `remove(id)` | Removes an entity; no-op when absent. Allocates nothing. |
| `clear()` | Removes every entity. Allocates nothing. |
| `has(id)` | Whether the id is currently stored. |
| `get size()` | Number of stored entities. |
| `queryRadius(x, y, radius): QueryResult` | All entities with `dist² <= radius²`, unsorted. Throws on negative radius. |
| `queryKNearest(x, y, k): QueryResult` | Up to `k` nearest entities, sorted ascending by distance. Throws on non-positive `k`. |

### Types

```typescript
interface SpatialHashOptions { cellSize: number; capacity: number }
interface QueryResult { ids: Uint32Array; count: number } // ids is reused — copy if you keep it
```

## Performance notes

- All per-frame work is flat-array arithmetic; the only per-call allocation is the (reused) result object shape, created once in the constructor.
- Entities that move between cells are unlinked and re-linked in O(chain length); buckets stay short when `cellSize` matches entity density.
- For mostly-static scenes, insert once and query freely — queries never mutate the index.

## License

MIT
