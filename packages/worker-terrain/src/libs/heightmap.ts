import type { TerrainChunk, TerrainChunkOptions } from '../types/index.js'
import { createPerlin2D, fbm } from './noise.js'
import { blendBiomes } from '../utils/noise/blendBiomes.js'
import assertOptions from '../utils/heightmap/assertOptions.js'
import { BASE_RESOLUTION, HEIGHT_AMPLITUDE } from '../const.js'

/**
 * Default CPU terrain generator: a seeded heightmap mesh whose density
 * follows the requested LOD. Deterministic for a given `{ size, lod, seed }`.
 * Elevation, moisture, temperature and detail fields derive from offset
 * seeds; biome blending plus fine detail shape the final relief.
 *
 * @param options World-space edge, LOD level and noise seed.
 * @returns Positions `(x, y, z)` grid plus two triangles per quad.
 * @throws {TypeError} On non-object options or non-finite seeds.
 * @throws {RangeError} On non-positive sizes or negative/non-integer LODs.
 */
export function createHeightmapChunk(options: TerrainChunkOptions): TerrainChunk {
  assertOptions(options)
  const step = 2 ** Math.min(options.lod, 8)
  const segments = Math.max(1, Math.floor(BASE_RESOLUTION / step))
  const side = segments + 1
  const positions = new Float32Array(side * side * 3)
  const indices = new Uint32Array(segments * segments * 6)

  const elevationField = createPerlin2D(options.seed)
  const moistureField = createPerlin2D(options.seed + 101.5)
  const temperatureField = createPerlin2D(options.seed + 202.5)
  const detailField = createPerlin2D(options.seed + 303.5)

  const frequency = 4 / options.size
  let v = 0
  for (let j = 0; j < side; j++) {
    for (let i = 0; i < side; i++) {
      const wx = (i / segments - 0.5) * options.size
      const wz = (j / segments - 0.5) * options.size
      const elevation = fbm(elevationField, wx * frequency, wz * frequency, 5)
      const moisture =
        fbm(moistureField, wx * frequency * 0.5 + 13.7, wz * frequency * 0.5, 3) * 0.5 + 0.5
      const temperature =
        fbm(temperatureField, wx * frequency * 0.5, wz * frequency * 0.5 + 7.3, 3) * 0.5 + 0.5
      const detail = fbm(detailField, wx * frequency * 4, wz * frequency * 4, 2)
      const height =
        (blendBiomes({ elevation, moisture, temperature }) - 0.5) * 2 * HEIGHT_AMPLITUDE +
        detail * 1.5
      const o = v * 3
      positions[o] = wx
      positions[o + 1] = height
      positions[o + 2] = wz
      v++
    }
  }

  let k = 0
  for (let j = 0; j < segments; j++) {
    for (let i = 0; i < segments; i++) {
      const a = j * side + i
      const b = a + 1
      const c = a + side
      const d = c + 1
      indices[k++] = a
      indices[k++] = c
      indices[k++] = b
      indices[k++] = b
      indices[k++] = c
      indices[k++] = d
    }
  }

  return { positions, indices, lod: options.lod }
}
