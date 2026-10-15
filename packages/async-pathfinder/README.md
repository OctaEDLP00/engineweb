# `@engineweb/async-pathfinder`

Grid-based A\* pathfinding that **slices heavy searches across multiple frames** with async generators, so NPC route recalculation never blocks input or rendering.

## Features

- Classic weighted A\* over a user-supplied `passable(x, y)` grid, 8-directional with corner-cut prevention.
- Optional **Theta\***: line-of-sight parent skipping during search plus greedy string-pulling after, for smooth any-angle paths.
- Optional Chaikin corner smoothing (`smoothPath`).
- Yields the expansion count every `maxExpansionsPerSlice` node expansions (with a real macrotask pause), keeping the browser event loop responsive.

## Installation

```bash
pnpm add @engineweb/async-pathfinder
```

## Usage

```typescript
import { findPath } from '@engineweb/async-pathfinder'

const passable = (x: number, y: number): boolean =>
  x >= 0 && y >= 0 && x < width && y < height && !walls.has(`${x},${y}`)

// Drive the search from the game loop — one slice per frame
const search = findPath(
  { start: { x: 2, y: 3 }, goal: { x: 40, y: 30 }, width, height, passable },
  { maxExpansionsPerSlice: 256, thetaStar: true },
)

for await (const expanded of search) {
  updateLoadingBar(expanded) // yielded progress; loop body runs between slices
  await nextFrame()
}
// `for await` discards the return value — capture it manually when you need the path:
```

```typescript
async function routeNpc(): Promise<void> {
  const search = findPath(
    { start, goal, width, height, passable },
    { thetaStar: true, smoothPath: true },
  )
  for (;;) {
    const step = await search.next()
    if (step.done) {
      npc.waypoints = step.value // Array<Vec2>, [] when unreachable
      break
    }
    await nextFrame() // keep 60 FPS while the search progresses
  }
}
```

## API

### `findPath(request: PathRequest, options?: PathfinderOptions): AsyncGenerator<number, Array<Vec2>>`

Yields the running expansion count after each slice; returns the waypoint list (`[]` when the goal is unreachable).

**`PathRequest`**

| Field | Description |
|---|---|
| `start` / `goal` | Integer cell coordinates `{ x, y }`. Must be in bounds and passable, else `RangeError`. |
| `width` / `height` | Positive integer grid dimensions. |
| `passable(x, y)` | Returns whether a cell can be entered. Called for in-bounds cells only during search (plus the start/goal validation). |

**`PathfinderOptions`**

| Option | Default | Description |
|---|---|---|
| `maxExpansionsPerSlice` | `512` | Node expansions per slice. Lower = smoother frames, more frames to finish. |
| `heuristicWeight` | `1` | `1` is classic A\*; `> 1` is greedier/faster but less optimal. |
| `thetaStar` | `false` | Any-angle paths via line-of-sight skipping + string-pulling. |
| `smoothPath` | `false` | One Chaikin corner-cutting pass over the final waypoints. |

## Performance notes

- All search state lives in preallocated `Float64Array`/`Int32Array` buffers sized `width × height`; the binary heap supports decrease-key via a position index.
- Diagonal moves cost `√2` and never cut corners (both orthogonal neighbors must be passable).
- Theta\* line-of-sight uses Bresenham cell traversal over your `passable` function — keep that function cheap.

## License

MIT
