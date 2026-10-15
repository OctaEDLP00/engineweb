/**
 * Static chunk-generation runtime, shipped as `dist/worker.js` and
 * importable via `@engineweb/worker-terrain/worker`.
 *
 * `createTerrainWorker` boots it with `{ type: 'init', source }`, compiling
 * the serialized generator once in worker scope; afterwards every
 * `{ id, options }` request runs against the compiled function and streams
 * the chunk back with Transferable buffers. Served as a classic worker
 * (no module imports at runtime — dependencies are bundled in).
 */
import type {
  TerrainChunkOptions,
  TerrainGenerator,
  TerrainWorkerInit,
  TerrainWorkerSuccess,
} from './types/index.js'
import assertChunkOptions from './utils/heightmap/assertChunkOptions.js'

// Dedicated worker scope: `self` here is the worker global, not `Window`,
// which exposes the transfer-list `postMessage` overload.
const scope = globalThis as unknown as DedicatedWorkerGlobalScope

let generate: TerrainGenerator | undefined
let initError: unknown

function fail(id: number, error: unknown): void {
  scope.postMessage({
    id,
    ok: false,
    error: error instanceof Error ? error.message : String(error),
  })
}

function boot(source: unknown): void {
  if (typeof source !== 'string' || source.length === 0) {
    initError = new TypeError('worker init source must be a function source string')
    return
  }
  try {
    generate = new Function('options', `return (${source})(options)`) as TerrainGenerator
    initError = undefined
  } catch (error) {
    initError = error
  }
}

scope.onmessage = (event: MessageEvent): void => {
  const message = event.data as TerrainWorkerInit | { id: unknown, options: unknown } | null
  if (!message || typeof message !== 'object') return
  if ((message as TerrainWorkerInit).type === 'init') {
    boot((message as TerrainWorkerInit).source)
    return
  }
  const { id, options } = message as { id: unknown, options: unknown }
  if (typeof id !== 'number' || !options || typeof options !== 'object') return
  try {
    if (initError) throw initError
    if (!generate) {
      throw new Error('worker generator not initialized: send { type: "init", source } first')
    }
    assertChunkOptions(options as TerrainChunkOptions)
    const chunk = generate(options as TerrainChunkOptions)
    if (
      !chunk ||
      !(chunk.positions instanceof Float32Array) ||
      !(chunk.indices instanceof Uint32Array)
    ) {
      throw new TypeError('generator must return { positions: Float32Array, indices: Uint32Array, lod }')
    }
    // Only transferable ArrayBuffers can cross the boundary — a
    // SharedArrayBuffer view would throw DataCloneError on post.
    const positions = chunk.positions.buffer
    const indices = chunk.indices.buffer
    if (!(positions instanceof ArrayBuffer) || !(indices instanceof ArrayBuffer)) {
      throw new TypeError('generator buffers must be backed by transferable ArrayBuffers')
    }
    const response: TerrainWorkerSuccess = {
      id,
      ok: true,
      positions,
      positionsByteOffset: chunk.positions.byteOffset,
      positionsLength: chunk.positions.length,
      indices,
      indicesByteOffset: chunk.indices.byteOffset,
      indicesLength: chunk.indices.length,
      lod: typeof chunk.lod === 'number' ? chunk.lod : (options as TerrainChunkOptions).lod,
    }
    scope.postMessage(response, [positions, indices])
  } catch (error) {
    fail(id, error)
  }
}
