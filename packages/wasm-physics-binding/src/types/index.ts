export interface WasmPhysicsOptions {
  /** URL of the compiled physics engine (`.wasm`). Required, non-empty. */
  moduleUrl: string | URL
  /**
   * Use a `SharedArrayBuffer`-backed memory when available. Requires a
   * cross-isolated context; `init()` throws where unavailable.
   */
  sharedMemory?: boolean
  /**
   * Maximum number of simulated rigid bodies; sizes the linear memory up
   * front. Positive integer, defaults to `1024`.
   */
  maxBodies?: number
  /**
   * Gravity applied on the Y axis in the JS fallback integrator. Finite
   * number, defaults to `-9.81`. Mutable at runtime via `gravity`.
   */
  gravity?: number
}

/** Body position/velocity triple: tuple or `{ x, y, z }` record. */
export type Vec3Like =
  readonly [number, number, number] | { readonly x: number; readonly y: number; readonly z: number }

/** Optional exports a physics module may provide; all are best-effort. */
export interface PhysicsExports {
  /** Advances the simulation by `dt` seconds. */
  step?: (dt: number) => void
  /** Alternative advance hook, used when `step` is absent. */
  update?: (dt: number) => void
  /** Alternative advance hook, used when `step`/`update` are absent. */
  integrate?: (dt: number) => void
  /** Engine-side body count, adopted after `init()` when it parses. */
  body_count?: () => number
}

export type Quantity<Q extends number> = Q

export type Tuple<T, Q extends number, Acc extends Array<T> = []> =
  Acc['length'] extends Quantity<Q> ? Acc : Tuple<T, Q, [...Acc, T]>

export interface TransformView {
  /**
   * Live zero-copy view over the transform matrices in WASM memory. Only
   * the first `bodyCount * 16` floats are valid; re-fetch per frame.
   */
  matrices: Float32Array
  /** Number of active bodies covered by `matrices`. */
  bodyCount: number
}
