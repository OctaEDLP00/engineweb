/** Chunk request: world-space edge, LOD level and deterministic noise seed. */
export interface TerrainChunkOptions {
  /** World-space size of the chunk edge. */
  size: number
  /** Level-of-detail index (0 = highest detail). */
  lod: number
  /** Deterministic noise seed. */
  seed: number
}

/** Generated chunk: interleaved positions plus triangle indices. */
export interface TerrainChunk {
  /** Interleaved vertex positions (x, y, z). */
  positions: Float32Array
  /** Triangle indices. */
  indices: Uint32Array
  /** LOD the chunk was generated at. */
  lod: number
}

/** Biome input sample; all fields are clamped into range by `blendBiomes`. */
export interface BiomeSample {
  /** Elevation field in `[-1, 1]`. */
  elevation: number
  /** Moisture field in `[0, 1]`. */
  moisture: number
  /** Temperature field in `[0, 1]`. */
  temperature: number
}

/**
 * First message bootstrapping the static worker with the serialized
 * generator. The worker evaluates `source` once; later `{ id, options }`
 * requests reuse the compiled function.
 */
export interface TerrainWorkerInit {
  /** Discriminant: always `'init'`. */
  type: 'init'
  /** `generate.toString()` source; must be self-contained (no closures). */
  source: string
}

/** Main-to-worker message: generate one chunk and post it back. */
export interface TerrainWorkerRequest {
  /** Correlates requests with responses. */
  id: number
  /** Chunk parameters forwarded to the generator. */
  options: TerrainChunkOptions
}

/** Worker-to-main success message carrying transferred chunk buffers. */
export interface TerrainWorkerSuccess {
  /** Correlates requests with responses. */
  id: number
  /** Discriminant: `true` carries buffers, `false` carries `error`. */
  ok: true
  /** Transferred vertex buffer (neutered worker-side). */
  positions: ArrayBuffer
  /** Byte offset of the view inside `positions`. */
  positionsByteOffset: number
  /** Float count of the positions view. */
  positionsLength: number
  /** Transferred index buffer (neutered worker-side). */
  indices: ArrayBuffer
  /** Byte offset of the view inside `indices`. */
  indicesByteOffset: number
  /** Uint count of the indices view. */
  indicesLength: number
  /** LOD the chunk was generated at. */
  lod: number
}

/** Worker-to-main error message for a failed chunk request. */
export interface TerrainWorkerFailure {
  /** Correlates requests with responses. */
  id: number
  /** Discriminant: `true` carries buffers, `false` carries `error`. */
  ok: false
  /** Worker-side failure message. */
  error: string
}

/** Either half of the worker protocol: success buffers or a failure message. */
export type TerrainWorkerResponse = TerrainWorkerSuccess | TerrainWorkerFailure

/**
 * A `Worker` that also accepts typed chunk requests off the main thread.
 */
export interface TerrainWorkerHandle extends Worker {
  /** Typed chunk request resolving with transferred views. */
  requestChunk: (options: TerrainChunkOptions) => Promise<TerrainChunk>
}

/** In-flight `requestChunk` promise awaiting a worker response. */
export interface PendingRequest {
  /** Fulfills the chunk promise. */
  resolve: (chunk: TerrainChunk) => void
  /** Rejects the chunk promise on worker errors. */
  reject: (error: unknown) => void
}

/**
 * Scalar noise field returning values roughly in `[-√2, √2]` (output scaling stretches 2D peaks).
 */
export type Noise2D = (x: number, y: number) => number

/**
 * Scalar 3D noise field returning values roughly in `[-1, 1]`. Ideal for voxel density.
 */
export type Noise3D = (x: number, y: number, z: number) => number

/** Pure chunk generator safe to serialize into a worker (no closures). */
export type TerrainGenerator = (options: TerrainChunkOptions) => TerrainChunk
