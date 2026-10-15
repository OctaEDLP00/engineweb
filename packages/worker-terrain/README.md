# `@engineweb/worker-terrain`

Infinite terrain generation (voxel or 2D heightmaps) running **100% inside Web Workers** via memory transfer (`Transferable` objects, `SharedArrayBuffer`-ready).

Heavy noise math and geometry building never touch the main thread, so the render loop holds a strict 60 FPS with zero stuttering or jank.

## Features

- Seeded Perlin noise in 2D (`createPerlin2D`) and 3D (`createPerlin3D`) with fractal Brownian motion (`fbm` / `fbm3D`).
- Multi-layer biome blending (`blendBiomes`): elevation, moisture and temperature fields modulate relief.
- LOD-aware heightmap mesher (`createHeightmapChunk`): each LOD level halves grid density; output is deterministic per `{ size, lod, seed }`.
- `createTerrainWorker()` offloads any `TerrainGenerator` to a dedicated worker and streams chunks back with **zero-copy transfers** — buffers are transferred, never copied.

## Installation

```bash
pnpm add @engineweb/worker-terrain
```

## Usage

### Generate a chunk on the main thread

```typescript
import { createHeightmapChunk } from '@engineweb/worker-terrain'

const chunk = createHeightmapChunk({ size: 128, lod: 0, seed: 1337 })
// chunk.positions: Float32Array (x, y, z per vertex)
// chunk.indices:   Uint32Array (two triangles per quad)
// chunk.lod:       0
```

### Generate chunks inside a Web Worker

```typescript
import {
  createHeightmapChunk,
  createTerrainWorker,
  type TerrainWorkerHandle,
} from '@engineweb/worker-terrain'

const worker = createTerrainWorker(createHeightmapChunk) as TerrainWorkerHandle

// The handle exposes a typed helper (the raw Worker protocol is { id, options } ⇄ transferable buffers)
const chunk = await worker.requestChunk({ size: 128, lod: 2, seed: 1337 })

worker.terminate()
```

Any pure function `(options: TerrainChunkOptions) => TerrainChunk` can be used as the generator — it is serialized into the worker at spawn time, so it must not close over outer scope.

### Custom noise fields

```typescript
import { blendBiomes, createPerlin2D, fbm } from '@engineweb/worker-terrain'

const elevation = createPerlin2D(42)
const height = elevation(12.5, 7.25) // ≈ [-1, 1]
const mountains = fbm(elevation, 12.5, 7.25, 5) // 5-octave fractal
const mask = blendBiomes({ elevation: mountains, moisture: 0.7, temperature: 0.4 })
```

### Custom voxel density fields

```typescript
import { createPerlin3D, fbm3D } from '@engineweb/worker-terrain'

// 3D density field sharing the 2D permutation table: positive = solid, negative = air
const density = createPerlin3D(7)
const solid = fbm3D(density, 12.5, 7.25, 3.0, 4) > 0
```

## API

### `createTerrainWorker(generate: TerrainGenerator): Worker`

Spawns a dedicated worker running `generate` off the main thread. Throws a `TypeError` for non-function generators and an `Error` where Web Workers are unavailable. The returned worker additionally exposes:

- `requestChunk(options: TerrainChunkOptions): Promise<TerrainChunk>` — posts `{ size, lod, seed }`, resolves with transferred `Float32Array`/`Uint32Array` views. Rejects with the worker-side error message on failure; all pending requests reject on worker `error` or `terminate()`.

### Static `worker` runtime

The runtime above ships as a real file — `@engineweb/worker-terrain/worker` (`dist/worker.js`) — instead of a template string, so it is typechecked, linted and bundled like any other module. `createTerrainWorker` loads it via `new URL('./worker.js', import.meta.url)` (a pattern Vite bundles natively) and bootstraps it with `{ type: 'init', source }`. For custom hosts, drive the protocol directly:

```typescript
import TerrainWorker from '@engineweb/worker-terrain/worker?worker' // Vite worker entry

const worker = new TerrainWorker()
worker.postMessage({ type: 'init', source: createHeightmapChunk.toString() })
worker.postMessage({ id: 1, options: { size: 64, lod: 0, seed: 1 } })
```

### `createHeightmapChunk(options: TerrainChunkOptions): TerrainChunk`

Built-in CPU generator. `size` is the world-space edge length, `lod` halves the base 64-segment grid per level (clamped so at least one quad remains), `seed` drives all noise fields. Heights combine biome-blended elevation (`±24` units) with fine detail (`±1.5`).

### Noise primitives

| Export | Description |
|---|---|
| `createSeededRandom(seed)` | Deterministic mulberry32 PRNG. |
| `createPerlin2D(seed)` | Seeded improved-Perlin field, output `≈ [-√2, √2]`. |
| `createPerlin3D(seed)` | Seeded 3D Perlin field sharing the 2D permutation table, output `≈ [-1, 1]`. Ideal for voxel density. |
| `fbm(noise, x, y, octaves?, lacunarity?, gain?)` | Fractal Brownian motion, normalized by amplitude sum. |
| `fbm3D(noise, x, y, z, octaves?, lacunarity?, gain?)` | fBm over a 3D field. Separate name because a 4th number would clash with 2D `octaves`. |
| `blendBiomes({ elevation, moisture, temperature })` | Height multiplier: moisture raises mountain mass, temperature softens peaks. |

### Types

```typescript
interface TerrainChunkOptions { size: number; lod: number; seed: number }
interface TerrainChunk { positions: Float32Array; indices: Uint32Array; lod: number }
type TerrainGenerator = (options: TerrainChunkOptions) => TerrainChunk
```

## License

MIT
