# @engineweb/worker-terrain

## 0.1.0

### Minor Changes

- 6ce7e0e: Add 3D noise primitives: the `Noise3D` type, `createPerlin3D` and `fbm3D`. The 3D field shares the seed-shuffled permutation table with the 2D field, so one seed drives heightmaps and voxel density together. Existing 2D `fbm` output is bit-identical.
- 6ce7e0e: Ship the chunk-generation worker as a real `dist/worker.js` module importable via `@engineweb/worker-terrain/worker` instead of an inline template string. `createTerrainWorker` loads it with `new URL('./worker.js', import.meta.url)` and bootstraps it with `{ type: 'init', source }`; the `{ id, options }` request protocol and transferable-buffer responses are unchanged.

### Patch Changes

- 6ce7e0e: Add unit test suites across all packages and expand JSDoc coverage on every module, type and utility. Includes two strictness fixes surfaced by the new tests: `NetInterpolator.push` now replaces same-timestamp snapshots at the buffer tail, and `WasmPhysicsBinding.addBody` rejects non-triple arrays instead of silently dropping components.

## 0.0.1

Initial release.
