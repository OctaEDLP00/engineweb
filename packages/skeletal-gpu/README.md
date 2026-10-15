# `@engineweb/skeletal-gpu`

GPU-oriented skeletal animation: skeletons and animation tables are packed CPU-side into flat buffers ready to upload as Texture Data or Storage Buffers, while sampling, blend trees and hierarchy composition run in allocation-free math over `Float32Array`s.

Hundreds of skinned characters animate without spiking the main thread — the renderer only uploads the resulting matrices.

## Features

- Skeleton registry with parent-before-child validation (single forward pass composes world matrices).
- Packed keyframes: `7` floats per bone per frame — quaternion + translation.
- Per-instance blend trees: any number of tracks weighted in `[0, 1]`, slerp sampling, hemisphere-safe rotation blending.
- `webgpu` / `webgl2` backend flag carried through for renderer dispatch decisions.
- Fixed instance pool (`maxInstances`) with `createInstance` / `destroyInstance` recycling.

## Installation

```bash
pnpm add @engineweb/skeletal-gpu
```

## Usage

```typescript
import { SkeletalGpu } from '@engineweb/skeletal-gpu'

const anim = new SkeletalGpu({ backend: 'webgpu', maxInstances: 256 })

// Bones must be ordered: every parent index is -1 or an earlier bone.
const skeleton = anim.registerSkeleton(
  [
    { name: 'hips', parent: -1 },
    { name: 'spine', parent: 0 },
    { name: 'head', parent: 1 },
  ],
  [
    { name: 'idle', durationSeconds: 2, keyframes: idleFrames }, // Float32Array, frames * bones * 7
    { name: 'run', durationSeconds: 1, keyframes: runFrames },
  ],
)

const orc = anim.createInstance(skeleton)
anim.setBlend(orc, 'idle', 0.7)
anim.setBlend(orc, 'run', 0.3)

function frame(dt: number): void {
  anim.update(dt)
  const matrices = anim.getInstanceMatrices(orc) // bones * 16 column-major floats
  device.queue.writeBuffer(instanceBuffer, 0, matrices) // → storage buffer / bone texture
}
```

Keyframe layout per frame, per bone (in bone order):

```
[qx, qy, qz, qw, tx, ty, tz]  // 7 floats, frames laid back-to-back
```

## API

### `new SkeletalGpu(options: SkeletalGpuOptions)`

| Option | Description |
|---|---|
| `backend` | `'webgpu'` \| `'webgl2'`. Anything else throws `TypeError`. |
| `maxInstances` | Instance pool size. Must be a positive integer. |

### Methods

| Method | Description |
|---|---|
| `registerSkeleton(bones, tracks): number` | Validates (non-empty bones, ordered parents, unique non-empty track names, positive durations, keyframe length a whole number of `bones × 7` frames) and deep-copies everything. Returns the skeleton id. |
| `createInstance(skeletonId): number` | Allocates a pooled slot with identity matrices. Throws when exhausted. |
| `destroyInstance(instanceId)` | Releases the slot for reuse. |
| `setBlend(instanceId, trackName, weight)` | Blend-tree weight in `[0, 1]`; `0` removes the entry. Unknown tracks and out-of-range weights throw. |
| `update(deltaSeconds)` | Advances every active instance: time wraps per track duration, weights normalize (zero total falls back to the first track), world matrices compose parent-first. `deltaSeconds` must be `>= 0`; `0` is a no-op. |
| `getInstanceMatrices(instanceId): Float32Array` | Live `bones × 16` column-major buffer. Upload it, don't hold-and-mutate it. |

## Performance notes

- Per-frame math uses module-level scratch buffers — `update()` allocates only when weights change shape (spread of the weight map); matrix composition itself is allocation-free.
- Bone order is enforced at registration precisely so `update()` needs no topological sort.

## License

MIT
