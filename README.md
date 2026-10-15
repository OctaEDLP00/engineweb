# 🎮 WebGame Ecosystem (`@engineweb/*`)

A collection of ultra-high-performance algorithms, data structures, and utilities engineered specifically for modern browser-based video games (TypeScript / ESM). Designed with a strong focus on maintaining strict 60 FPS, zero-GC memory management, and robust concurrency.

## 📦 Monorepo Packages Structure

```
packages/
├── worker-terrain/            # Procedural generation in Web Workers (LOD & Biomes)
├── typed-spatial-hash/        # Zero-GC spatial partitioning using TypedArrays
├── async-pathfinder/          # Fragmented A* / Theta* pathfinding (Yielding)
├── net-interpolator/          # Multiplayer snapshot sync with Effect Schema & Streams
├── signal-ecs/                # Reactive ECS architecture backed by Signals & SoA
├── wasm-physics-binding/      # Zero-copy WebAssembly physics interop layer
├── effect-asset-pipeline/     # Resilient asset loader and cache manager powered by Effect
├── skeletal-gpu/              # GPU-accelerated skeletal animation & skinning via WebGPU/WebGL2
└── audio-synthesis/           # Procedural sound design and adaptive music using WebAudio & AudioWorklet
```

---

## 🛠️ Detailed Package Breakdown

### 1. Core Algorithmic & Architectural Packages

#### `@engineweb/worker-terrain`
A specialized package for infinite terrain generation (voxel or 2D heightmaps) running 100% inside **Web Workers** via memory transfer (`SharedArrayBuffer` / `Transferable Objects`).
* **Core Features:** Optimized Simplex/Perlin noise, multi-layer biome blending (temperature, humidity, elevation), and Level of Detail (LOD) chunk management.
* **Web Advantage:** Eliminates stuttering/jank on the main rendering thread by offloading heavy geometry and noise math.

#### `@engineweb/typed-spatial-hash`
A high-performance spatial indexing structure (Spatial Hashing / Quadtree) built exclusively on top of **TypedArrays (`Float32Array`, `Uint32Array`)** instead of standard JavaScript heap objects.
* **Core Features:** Broad-phase collision detection, radius searches, and $k$-NN (nearest neighbor) queries.
* **Web Advantage:** Zero dynamic object allocation during runtime, completely eliminating Garbage Collection (GC) pauses while handling 5,000+ simultaneous entities.

#### `@engineweb/async-pathfinder`
A pathfinding engine (A\* and NavMesh) utilizing JavaScript generators (`async/await` / `yield`) to **slice heavy calculations across multiple frames**.
* **Core Features:** Adaptive A\*, Theta\* (for smooth line-of-sight navigation), and Bézier curve trajectory smoothing.
* **Web Advantage:** Yields execution back to the browser event loop regularly, ensuring inputs remain snappy and responsive even during heavy NPC route recalculations.

#### `@engineweb/signal-ecs`
An ultra-lightweight Entity Component System (ECS) driven by modern **Signals** and structured using **Structure of Arrays (SoA)** principles over `TypedArrays`.
* **Core Features:** Reactive component bindings, granular UI-to-Canvas synchronization without full re-renders.
* **Web Advantage:** Only updates components whose values have actually mutated, maximizing hybrid DOM + WebGL rendering loops.

---

### 2. Networking, Physics & Effect-Powered Infrastructure

#### `@engineweb/net-interpolator` *(Powered by Effect)*
A lightweight mathematical utility library combined with **Effect** for managing real-time multiplayer networking lag over WebSockets or WebRTC.
* **Core Features:** Snapshot interpolation (linear/cubic), movement extrapolation, and lag compensation routines.
* **Effect Integration:** Uses `@effect/schema` for strict packet validation and Effect Streams/PubSub for pipeline management, jitter buffers, and reconnection logic.

#### `@engineweb/wasm-physics-binding`
A zero-copy utility wrapper for compiled WebAssembly physics engines (like Rapier or Box2D).
* **Core Features:** Shared memory views where `WebAssembly.Memory` directly updates transformation matrices in WebGL/Three.js via pointers.
* **Web Advantage:** Bypasses serialization overhead and bottlenecks between the JavaScript runtime and WebAssembly boundary.

#### `@engineweb/effect-asset-pipeline` *(Powered by Effect)*
A resilient asset orchestrator (textures, 3D models, audio, sprite sheets) built completely on top of **Effect**.
* **Core Features:** Progressive download tracking with pause/resume via Effect Streams, exponential backoff retries, and LRU GPU memory cache purging.
* **Web Advantage:** Turns fragile browser network operations into a completely type-safe, robust pipeline.

---

### 3. Graphics & Audio Rendering Engines

#### `@engineweb/skeletal-gpu`
A specialized animation pipeline that offloads bone interpolation (*Skeletal Rigging* and *Blend Trees*) directly to GPU shaders or Compute Shaders.
* **Core Features:** Blend shapes, quaternions, dual quaternions for smooth skinning, uploading animation tables as Texture Data or Storage Buffers.
* **Web Advantage:** Renders hundreds of animated characters simultaneously without spiking CPU utilization.

#### `@engineweb/audio-synthesis`
A procedural sound effects and adaptive music generator utilizing Web Audio API nodes and `AudioWorklet`.
* **Core Features:** FM synthesis, noise generators (white, pink, brown), and ADSR envelope interpolation.
* **Web Advantage:** Eliminates heavy MP3/WAV network downloads by synthesizing sound effects (footsteps, laser shots, explosions) on the fly with minimal bundle impact.

---

## 🚀 Getting Started

Clone the monorepo and install dependencies using **pnpm**:

```bash
git clone https://github.com/webgame-ecosystem/core.git
cd core
pnpm install
```

### Example Usage (`@engineweb/net-interpolator` with Effect)

```typescript
import { Effect, Stream } from "effect"
import { NetInterpolator } from "@engineweb/net-interpolator"

const networkStream = Stream.succeed({ x: 100, y: 200, timestamp: Date.now() })

const gameLoop = NetInterpolator.pipe(
  networkStream,
  // Effect-powered stream processing for smooth state interpolation
)

Effect.runPromise(gameLoop)
```

## 🛠️ Contributing

Please review the contributing guidelines inside each package directory under `packages/` before submitting a pull request.

## 📄 License

MIT License.