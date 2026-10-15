# @engineweb/wasm-physics-binding

## 0.0.2

### Patch Changes

- 6ce7e0e: Add unit test suites across all packages and expand JSDoc coverage on every module, type and utility. Includes two strictness fixes surfaced by the new tests: `NetInterpolator.push` now replaces same-timestamp snapshots at the buffer tail, and `WasmPhysicsBinding.addBody` rejects non-triple arrays instead of silently dropping components.
- 6ce7e0e: Validate the `\0asm` magic bytes before compiling in `init()`: HTML error pages served with HTTP 200 by SPA servers and CDNs now fall back to the JS integrator with a descriptive reason instead of a cryptic compile failure.

## 0.0.1

Initial release.
