/**
 * Zero-GC spatial partitioning (Spatial Hashing / Quadtree) built exclusively
 * on TypedArrays (`Float32Array`, `Uint32Array`) instead of heap objects.
 *
 * @packageDocumentation
 */

export type * from './src/types/index.js'
export * from './src/TypedSpatialHash.js'
