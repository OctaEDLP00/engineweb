import { describe, expect, it } from 'vitest'
import { BASE_RESOLUTION } from '../const.js'
import { createHeightmapChunk } from './heightmap.js'

describe('createHeightmapChunk', () => {
  it('builds the base grid at LOD 0', () => {
    const chunk = createHeightmapChunk({ size: 128, lod: 0, seed: 1337 })
    const side = BASE_RESOLUTION + 1
    expect(chunk.positions.length).toBe(side * side * 3)
    expect(chunk.indices.length).toBe(BASE_RESOLUTION * BASE_RESOLUTION * 6)
    expect(chunk.lod).toBe(0)
  })

  it('halves density per LOD level', () => {
    const chunk = createHeightmapChunk({ size: 128, lod: 1, seed: 1337 })
    expect(chunk.positions.length).toBe(33 * 33 * 3)
    expect(chunk.indices.length).toBe(32 * 32 * 6)
    expect(chunk.lod).toBe(1)
  })

  it('is deterministic per options', () => {
    const options = { size: 100, lod: 1, seed: 42 }
    const a = createHeightmapChunk(options)
    const b = createHeightmapChunk(options)
    expect(Array.from(a.positions)).toEqual(Array.from(b.positions))
    expect(Array.from(a.indices)).toEqual(Array.from(b.indices))
  })

  it('emits valid triangle indices', () => {
    const chunk = createHeightmapChunk({ size: 64, lod: 2, seed: 5 })
    const vertices = chunk.positions.length / 3
    for (const index of chunk.indices) {
      expect(index).toBeGreaterThanOrEqual(0)
      expect(index).toBeLessThan(vertices)
    }
  })

  it('validates options', () => {
    expect(() => createHeightmapChunk({ size: 0, lod: 0, seed: 1 })).toThrow(RangeError)
    expect(() => createHeightmapChunk({ size: 10, lod: -1, seed: 1 })).toThrow(RangeError)
    expect(() => createHeightmapChunk({ size: 10, lod: 1.5, seed: 1 })).toThrow(RangeError)
    expect(() => createHeightmapChunk({ size: 10, lod: 0, seed: Number.NaN })).toThrow(TypeError)
    expect(() => createHeightmapChunk(null as never)).toThrow(TypeError)
  })
})
