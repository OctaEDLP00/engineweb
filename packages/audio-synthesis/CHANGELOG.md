# @engineweb/audio-synthesis

## 0.1.0

### Minor Changes

- 6ce7e0e: Ship the `EngineWebNoiseProcessor` worklet as a real `dist/processor.js` module importable via `@engineweb/audio-synthesis/processor` instead of an inline template string. `init()` loads it with `new URL('./processor.js', import.meta.url)`; unresolvable modules fall back to buffer-based noise as before.
- 6ce7e0e: Add master volume control: `get masterVolume()` reports the current output level and `setMasterVolume(value)` sets it in `[0, 1]`, storing the value when called before `init()` so game settings can apply eagerly.

### Patch Changes

- 6ce7e0e: Add unit test suites across all packages and expand JSDoc coverage on every module, type and utility. Includes two strictness fixes surfaced by the new tests: `NetInterpolator.push` now replaces same-timestamp snapshots at the buffer tail, and `WasmPhysicsBinding.addBody` rejects non-triple arrays instead of silently dropping components.

## 0.0.1

Initial release.
