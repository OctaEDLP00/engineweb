import { DEFAULT_GRAVITY, DEFAULT_MAX_BODIES, MATRIX_STRIDE, PAGE_BYTES } from './const.js'
import type { PhysicsExports, TransformView, Vec3Like, WasmPhysicsOptions } from './types/index.js'
import readVec3 from './utils/readVec3.js'
import isWebAssemblyBinary from './utils/isWebAssemblyBinary.js'

/**
 * Zero-copy bridge between a compiled physics engine and the renderer.
 *
 * The binding owns one canonical `WebAssembly.Memory` holding every body
 * matrix. Modules importing `env.memory` simulate in place; otherwise a JS
 * semi-implicit Euler fallback integrates over identical memory, so
 * {@link getTransformView} always returns live data. Check {@link usingWasm}
 * to learn which backend drives {@link step}.
 *
 * @example
 * ```typescript
 * const physics = new WasmPhysicsBinding({ moduleUrl: '/physics/engine.wasm' })
 * await physics.init()
 * const crate = physics.addBody([0, 10, 0])
 * physics.step(1 / 60)
 * mesh.setMatrixAt(crate, tmp.fromArray(physics.getTransformView().matrices, crate * 16))
 * ```
 */
export class WasmPhysicsBinding {
  readonly moduleUrl: string | URL
  readonly sharedMemory: boolean
  readonly maxBodies: number
  gravity: number

  private memory: WebAssembly.Memory | null = null
  private instance: WebAssembly.Instance | null = null
  private moduleSharesMemory = false
  private fallbackReason: string | null = null
  private matrices: Float32Array = new Float32Array(0)
  private readonly velocities: Float32Array
  private activeBodies = 0
  private readonly view: TransformView

  /**
   * Validates options and preallocates velocity storage. Linear memory is
   * allocated later in {@link init}.
   *
   * @param options Module URL plus optional budgets; see {@link WasmPhysicsOptions}.
   * @throws {TypeError} On missing or mistyped `moduleUrl`.
   * @throws {RangeError} On non-positive integer `maxBodies` or non-finite `gravity`.
   */
  constructor(options: WasmPhysicsOptions) {
    if (
      !options ||
      options.moduleUrl === undefined ||
      options.moduleUrl === null ||
      options.moduleUrl === ''
    ) {
      throw new TypeError('moduleUrl is required')
    }
    if (typeof options.moduleUrl !== 'string' && !(options.moduleUrl instanceof URL)) {
      throw new TypeError('moduleUrl must be a string or URL')
    }
    const maxBodies = options.maxBodies ?? DEFAULT_MAX_BODIES
    if (!Number.isInteger(maxBodies) || maxBodies <= 0) {
      throw new RangeError('maxBodies must be a positive integer')
    }
    const gravity = options.gravity ?? DEFAULT_GRAVITY
    if (!Number.isFinite(gravity)) {
      throw new RangeError('gravity must be a finite number')
    }
    this.moduleUrl = options.moduleUrl
    this.sharedMemory = options.sharedMemory ?? false
    this.maxBodies = maxBodies
    this.gravity = gravity
    this.velocities = new Float32Array(maxBodies * 3)
    this.view = { matrices: this.matrices, bodyCount: 0 }
  }

  /** True when a WASM module sharing our memory drives `step()`; `false` in JS fallback mode. */
  get usingWasm(): boolean {
    return this.instance !== null && this.moduleSharesMemory
  }

  /**
   * Why the JS fallback integrator is in use (`null` when WASM drives):
   * fetch/compile failure or a module that does not import `env.memory`.
   */
  get fallback(): string | null {
    return this.usingWasm ? null : this.fallbackReason
  }

  /** Number of bodies currently simulated. */
  get bodyCount(): number {
    return this.activeBodies
  }

  private ensureInitialized(): WebAssembly.Memory {
    if (!this.memory) {
      throw new Error('WasmPhysicsBinding: call init() before stepping or reading transforms')
    }
    if (this.matrices.buffer !== this.memory.buffer) {
      this.matrices = new Float32Array(this.memory.buffer, 0, this.maxBodies * MATRIX_STRIDE)
    }
    return this.memory
  }

  private writeIdentity(index: number): void {
    const o = index * MATRIX_STRIDE
    const m = this.matrices
    m[o] = 1
    m[o + 1] = 0
    m[o + 2] = 0
    m[o + 3] = 0
    m[o + 4] = 0
    m[o + 5] = 1
    m[o + 6] = 0
    m[o + 7] = 0
    m[o + 8] = 0
    m[o + 9] = 0
    m[o + 10] = 1
    m[o + 11] = 0
    m[o + 12] = 0
    m[o + 13] = 0
    m[o + 14] = 0
    m[o + 15] = 1
  }

  /**
   * Allocates the canonical linear memory (identity matrices), then fetches,
   * compiles and instantiates the module. Fetch failures, non-WebAssembly
   * responses (e.g. HTML error pages served with HTTP 200), compile
   * failures and modules that ignore `env.memory` degrade to the JS
   * fallback instead of rejecting — inspect {@link fallback} afterwards.
   *
   * @throws {Error} When `sharedMemory` is set but `SharedArrayBuffer` is unavailable.
   */
  async init(): Promise<void> {
    const pages = Math.max(1, Math.ceil((this.maxBodies * MATRIX_STRIDE * 4) / PAGE_BYTES))
    if (this.sharedMemory && typeof SharedArrayBuffer === 'undefined') {
      throw new Error('WasmPhysicsBinding: SharedArrayBuffer is not available in this environment')
    }
    this.memory = new WebAssembly.Memory({
      initial: pages,
      maximum: pages,
      ...(this.sharedMemory ? { shared: true } : {}),
    } as WebAssembly.MemoryDescriptor)
    this.matrices = new Float32Array(this.memory.buffer, 0, this.maxBodies * MATRIX_STRIDE)
    for (let i = 0; i < this.maxBodies; i++) this.writeIdentity(i)
    this.instance = null
    this.moduleSharesMemory = false

    let bytes: ArrayBuffer
    let contentType: string | null
    try {
      const response = await fetch(this.moduleUrl)
      if (!response.ok) throw new Error(`WASM fetch failed with HTTP ${response.status}`)
      contentType = response.headers.get('content-type')
      bytes = await response.arrayBuffer()
    } catch (error) {
      this.fallbackReason = error instanceof Error ? error.message : String(error)
      return
    }

    // Gate on magic bytes, not on HTTP status: SPA servers and CDNs often
    // answer unknown routes with HTML and HTTP 200. The content-type header
    // is only a hint (many hosts serve `.wasm` as octet-stream), so the
    // `\0asm` prefix plus version word decide.
    if (!isWebAssemblyBinary(bytes)) {
      const hint = contentType ? ` (content-type: ${contentType})` : ''
      this.fallbackReason =
        `WASM module at ${String(this.moduleUrl)} is not a WebAssembly binary${hint}; ` +
        'JS fallback integrates local bodies'
      return
    }

    try {
      const module = await WebAssembly.compile(bytes)
      const wantsMemory = WebAssembly.Module.imports(module).some(
        entry => entry.module === 'env' && entry.name === 'memory' && entry.kind === 'memory',
      )
      const imports: WebAssembly.Imports = wantsMemory ? { env: { memory: this.memory } } : {}
      this.instance = await WebAssembly.instantiate(module, imports)
      this.moduleSharesMemory = wantsMemory
      const exports = this.instance.exports as unknown as PhysicsExports
      if (typeof exports.body_count === 'function') {
        try {
          const count = exports.body_count()
          if (Number.isInteger(count) && count >= 0) {
            this.activeBodies = Math.min(count, this.maxBodies)
          }
        } catch {
          // Engine-side count is best-effort; keep the JS-side count.
        }
      }
      if (!wantsMemory) {
        this.fallbackReason =
          'module does not import env.memory; JS fallback integrates local bodies'
      }
    } catch (error) {
      this.instance = null
      this.fallbackReason = error instanceof Error ? error.message : String(error)
    }
  }

  /**
   * Spawns a body with an identity matrix plus translation, and zero (or
   * given) velocity. Requires {@link init}.
   *
   * @param position Spawn `[x, y, z]` tuple or record.
   * @param velocity Initial velocity, defaults to rest.
   * @returns Body index addressing `matrices[index * 16]`.
   * @throws {Error} Before `init()` or when the body budget is exhausted.
   * @throws {TypeError} On malformed vectors; see `readVec3`.
   * @throws {RangeError} On non-finite vector components.
   */
  addBody(position: Vec3Like, velocity: Vec3Like = [0, 0, 0]): number {
    this.ensureInitialized()
    if (this.activeBodies >= this.maxBodies) {
      throw new Error('WasmPhysicsBinding: body capacity exhausted')
    }
    const [px, py, pz] = readVec3(position, 'position')
    const [vx, vy, vz] = readVec3(velocity, 'velocity')
    const index = this.activeBodies++
    this.writeIdentity(index)
    const o = index * MATRIX_STRIDE
    this.matrices[o + 12] = px
    this.matrices[o + 13] = py
    this.matrices[o + 14] = pz
    this.velocities[index * 3] = vx
    this.velocities[index * 3 + 1] = vy
    this.velocities[index * 3 + 2] = vz
    return index
  }

  /**
   * Returns a zero-copy view of body transform matrices in WASM memory.
   * Only the first `bodyCount * 16` column-major floats are valid;
   * translation sits at slots `[12, 13, 14]` of each matrix. Re-fetch per
   * frame — the view re-attaches if the buffer detaches.
   *
   * @returns The live shared view object (same identity every call).
   * @throws {Error} Before {@link init}.
   */
  getTransformView(): TransformView {
    this.ensureInitialized()
    this.view.matrices = this.matrices.subarray(0, this.activeBodies * MATRIX_STRIDE)
    this.view.bodyCount = this.activeBodies
    return this.view
  }

  /**
   * Advances the physics simulation by `deltaSeconds`: calls the module's
   * `step`/`update`/`integrate` export when it shares our memory, otherwise
   * runs the JS semi-implicit Euler fallback (gravity plus velocity).
   *
   * @param deltaSeconds Positive finite timestep in seconds.
   * @throws {RangeError} On non-positive or non-finite timesteps.
   * @throws {Error} Before {@link init}.
   */
  step(deltaSeconds: number): void {
    if (!Number.isFinite(deltaSeconds) || deltaSeconds <= 0) {
      throw new RangeError('deltaSeconds must be positive')
    }
    this.ensureInitialized()
    if (this.usingWasm) {
      const exports = (this.instance as WebAssembly.Instance).exports as unknown as PhysicsExports
      const advance = exports.step ?? exports.update ?? exports.integrate
      if (typeof advance === 'function') {
        advance.call(exports, deltaSeconds)
        return
      }
    }
    const m = this.matrices
    const v = this.velocities
    const g = this.gravity * deltaSeconds
    for (let i = 0; i < this.activeBodies; i++) {
      const vo = i * 3
      const vy = v[vo + 1] + g
      v[vo + 1] = vy
      const o = i * MATRIX_STRIDE
      m[o + 12] += v[vo] * deltaSeconds
      m[o + 13] += vy * deltaSeconds
      m[o + 14] += v[vo + 2] * deltaSeconds
    }
  }
}
