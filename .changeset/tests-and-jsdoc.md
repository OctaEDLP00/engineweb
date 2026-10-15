---
'@engineweb/async-pathfinder': patch
'@engineweb/audio-synthesis': patch
'@engineweb/effect-asset-pipeline': patch
'@engineweb/net-interpolator': patch
'@engineweb/signal-ecs': patch
'@engineweb/skeletal-gpu': patch
'@engineweb/typed-spatial-hash': patch
'@engineweb/wasm-physics-binding': patch
'@engineweb/worker-terrain': patch
---

Add unit test suites across all packages and expand JSDoc coverage on every module, type and utility. Includes two strictness fixes surfaced by the new tests: `NetInterpolator.push` now replaces same-timestamp snapshots at the buffer tail, and `WasmPhysicsBinding.addBody` rejects non-triple arrays instead of silently dropping components.
