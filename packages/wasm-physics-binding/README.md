# `@engineweb/wasm-physics-binding`

Zero-copy interop for compiled WebAssembly physics engines (Rapier, Box2D, …): one canonical `WebAssembly.Memory` holds every body matrix, shared directly with the WASM module and readable from WebGL/Three.js without serialization.

When no compatible module is reachable, a built-in JS integrator keeps the same memory contract, so games boot and stay testable anywhere.

## Features

- Canonical linear memory (`SharedArrayBuffer`-backed when `sharedMemory: true`) owned by the binding.
- Modules that import `env.memory` simulate **in place**; `getTransformView()` hands out live `Float32Array` views.
- Graceful fallback: semi-implicit Euler integration (gravity + velocity) over identical memory when the module can't load.
- `usingWasm` / `fallback` report exactly which backend drives `step()`.

## Installation

```bash
pnpm add @engineweb/wasm-physics-binding
```

## Usage

```typescript
import { WasmPhysicsBinding } from '@engineweb/wasm-physics-binding'

const physics = new WasmPhysicsBinding({
  moduleUrl: '/physics/engine.wasm',
  sharedMemory: true, // requires crossOriginIsolated
  maxBodies: 512,
})

await physics.init() // fetches, compiles and instantiates (or falls back)

const crate = physics.addBody([0, 10, 0], [1, 0, 0])

setInterval(() => {
  physics.step(1 / 60)
  const { matrices, bodyCount } = physics.getTransformView()
  // matrices: bodyCount * 16 column-major floats, translation at [12, 13, 14]
  threeMesh.setMatrixAt(crate, tmpMatrix.fromArray(matrices, crate * 16))
}, 1000 / 60)
```

## WASM module contract

For full zero-copy simulation, compile the engine so that it:

1. **Imports** `env.memory` (a `WebAssembly.Memory`) and keeps body transforms there as packed column-major 4×4 matrices.
2. Optionally exports **one** of `step(dt)`, `update(dt)`, `integrate(dt)` — called by `step()`.
3. Optionally exports `body_count(): number` — adopted as the body count after `init()`.

If the module doesn't import `env.memory`, `usingWasm` stays `false` and the JS fallback integrates local bodies instead. Responses without the `\0asm` magic (e.g. HTML error pages served with HTTP 200) are rejected into the fallback the same way. The reason is always available via `fallback`.

## API

### `new WasmPhysicsBinding(options: WasmPhysicsOptions)`

| Option | Default | Description |
|---|---|---|
| `moduleUrl` | — | URL of the `.wasm` binary. Required. |
| `sharedMemory` | `false` | Back memory with `SharedArrayBuffer`. Throws in `init()` where unavailable. |
| `maxBodies` | `1024` | Body budget; sizes the memory up front. Positive integer. |
| `gravity` | `-9.81` | Y-axis gravity for the JS fallback integrator. Mutable via `physics.gravity`. |

### Methods

| Method | Description |
|---|---|
| `init(): Promise<void>` | Allocates memory (identity matrices), fetches/compiles/instantiates. Never rejects on fetch/compile failure — records the reason in `fallback` instead. |
| `addBody(position, velocity?): number` | Spawns a body, returns its index. Accepts `[x, y, z]` tuples or `{ x, y, z }`. Throws when full. Requires `init()`. |
| `step(deltaSeconds)` | Advances simulation; WASM export when shared, JS Euler otherwise. Throws `RangeError` on non-positive dt. |
| `getTransformView(): { matrices, bodyCount }` | Live zero-copy view. Only the first `bodyCount * 16` floats are valid. Throws before `init()`. |
| `get usingWasm()` | Whether a memory-sharing WASM module drives `step()`. |
| `get fallback()` | Human-readable reason for JS mode, or `null` when WASM drives. |
| `get bodyCount()` | Active body count. |

Memory is re-attached automatically if the buffer ever detaches (e.g. after growth), so views obtained earlier stay conceptually valid — re-call `getTransformView()` per frame.

## License

MIT
