import type {
  PendingRequest,
  TerrainChunk,
  TerrainChunkOptions,
  TerrainGenerator,
  TerrainWorkerHandle,
  TerrainWorkerInit,
  TerrainWorkerResponse,
} from './types/index.js'
import assertChunkOptions from './utils/heightmap/assertChunkOptions.js'

/**
 * Spawns a dedicated Web Worker that generates terrain chunks off the main
 * thread and streams them back using Transferable objects.
 *
 * The worker runtime is a real module (`dist/worker.js`, importable as
 * `@engineweb/worker-terrain/worker`), loaded here via
 * `new URL('./worker.js', import.meta.url)` — a pattern bundlers like Vite
 * turn into a bundled worker automatically. The generator is sent once as
 * `{ type: 'init', source }` and compiled in worker scope, so it must be
 * self-contained (no closures over outer scope). Afterwards the returned
 * worker exposes an additive `requestChunk(options)` helper that resolves
 * with the generated chunk; the underlying buffers are transferred, never
 * copied. `terminate()` rejects pending requests.
 *
 * @param generate Pure `(options) => TerrainChunk` function.
 * @returns Worker handle with `requestChunk` and a cleaning `terminate`.
 * @throws {TypeError} On non-function generators or unserializable functions.
 * @throws {Error} Where Web Workers are unavailable.
 *
 * @example
 * ```typescript
 * const worker = createTerrainWorker(createHeightmapChunk) as TerrainWorkerHandle
 * const chunk = await worker.requestChunk({ size: 128, lod: 2, seed: 1337 })
 * worker.terminate()
 * ```
 */
export function createTerrainWorker(generate: TerrainGenerator): Worker {
  if (typeof generate !== 'function') {
    throw new TypeError('createTerrainWorker expects a generator function')
  }
  if (typeof Worker === 'undefined') {
    throw new Error('@engineweb/worker-terrain: Web Workers are not available in this environment')
  }
  let source: string
  try {
    source = generate.toString()
  } catch {
    throw new TypeError('createTerrainWorker: unable to serialize the generator function')
  }

  const url = new URL('./worker.js', import.meta.url)
  const handle = new Worker(url) as TerrainWorkerHandle
  const pending = new Map<number, PendingRequest>()
  let sequence = 0

  const rejectAll = (error: unknown): void => {
    for (const entry of pending.values()) entry.reject(error)
    pending.clear()
  }

  handle.addEventListener('message', (event: MessageEvent) => {
    const message = event.data as TerrainWorkerResponse | null
    if (!message || typeof message.id !== 'number') return
    const entry = pending.get(message.id)
    if (!entry) return
    pending.delete(message.id)
    if (message.ok === true) {
      try {
        entry.resolve({
          positions: new Float32Array(
            message.positions,
            message.positionsByteOffset ?? 0,
            message.positionsLength,
          ),
          indices: new Uint32Array(
            message.indices,
            message.indicesByteOffset ?? 0,
            message.indicesLength,
          ),
          lod: message.lod,
        })
      } catch (error) {
        entry.reject(error)
      }
    } else {
      entry.reject(
        new Error(typeof message.error === 'string' ? message.error : 'terrain generation failed'),
      )
    }
  })

  handle.addEventListener('error', (event: Event) => {
    const error =
      event instanceof ErrorEvent ?
        (event.error ?? new Error(event.message))
      : new Error('terrain worker error')
    rejectAll(error)
  })

  const rawTerminate = handle.terminate.bind(handle)
  handle.terminate = (): void => {
    rejectAll(new Error('terrain worker terminated'))
    rawTerminate()
  }

  handle.requestChunk = (options: TerrainChunkOptions): Promise<TerrainChunk> => {
    assertChunkOptions(options)
    const id = ++sequence
    return new Promise<TerrainChunk>((resolve, reject) => {
      pending.set(id, { resolve, reject })
      handle.postMessage({
        id,
        options: { size: options.size, lod: options.lod, seed: options.seed },
      })
    })
  }

  const init: TerrainWorkerInit = { type: 'init', source }
  handle.postMessage(init)

  return handle
}
