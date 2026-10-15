/**
 * Canonical interop contract. A physics `.wasm` module may optionally import
 * our shared linear memory as `env.memory` and export any of:
 *
 * - `step(dt: number)` / `update(dt)` / `integrate(dt)` — advance simulation.
 * - `body_count(): number` — adopt the engine-side body count after `init()`.
 *
 * When no compatible module is reachable, the binding transparently falls back
 * to a JS semi-implicit Euler integrator over the same memory, so the
 * zero-copy `getTransformView()` contract always holds. See `usingWasm`.
 */

/** Column-major 4x4 floats per body matrix. */
export const MATRIX_STRIDE = 16
/** Bytes per WebAssembly memory page (64 KiB). */
export const PAGE_BYTES = 65536
/** Default body budget when `maxBodies` is omitted. */
export const DEFAULT_MAX_BODIES = 1024
/** Default Y-axis gravity for the JS fallback integrator. */
export const DEFAULT_GRAVITY = -9.81
