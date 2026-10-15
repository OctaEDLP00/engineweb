/**
 * Procedural terrain generation (voxel or 2D heightmaps) running 100% inside
 * Web Workers via `SharedArrayBuffer` / `Transferable` objects.
 *
 * @packageDocumentation
 */

export type * from './src/types/index.js'
export * from './src/createTerrainWorker.js'
export * from './src/libs/noise.js'
export * from './src/libs/heightmap.js'
export { BASE_RESOLUTION, HEIGHT_AMPLITUDE } from './src/const.js'
export { blendBiomes } from './src/utils/noise/blendBiomes.js'
export { createSeededRandom } from './src/utils/noise/createSeededRandom.js'
