import type { TerrainChunkOptions } from '../../types/index.js'

/**
 * Validates heightmap chunk options: object shape, positive finite size,
 * non-negative integer LOD and finite seed.
 *
 * @param options Candidate `{ size, lod, seed }`.
 * @throws {TypeError} On non-object options or non-finite seeds.
 * @throws {RangeError} On non-positive sizes or bad LODs.
 */
export default function assertOptions(options: TerrainChunkOptions): void {
  if (!options || typeof options !== 'object') {
    throw new TypeError('createHeightmapChunk expects { size, lod, seed }')
  }
  if (!Number.isFinite(options.size) || options.size <= 0) {
    throw new RangeError('options.size must be a positive number')
  }
  if (!Number.isInteger(options.lod) || options.lod < 0) {
    throw new RangeError('options.lod must be a non-negative integer')
  }
  if (!Number.isFinite(options.seed)) {
    throw new TypeError('options.seed must be a finite number')
  }
}
