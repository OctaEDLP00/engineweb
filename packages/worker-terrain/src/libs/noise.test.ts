import { describe, expect, it } from 'vitest'
import { blendBiomes } from '../utils/noise/blendBiomes.js'
import { createSeededRandom } from '../utils/noise/createSeededRandom.js'
import { createPerlin2D, createPerlin3D, fbm, fbm3D } from './noise.js'

describe('createSeededRandom', () => {
  it('is deterministic per seed and varies across seeds', () => {
    const a = createSeededRandom(42)
    const b = createSeededRandom(42)
    expect(a()).toBe(b())
    expect(a()).toBe(b())
    expect(createSeededRandom(1)()).not.toBe(createSeededRandom(2)())
  })

  it('emits values in [0, 1)', () => {
    const random = createSeededRandom(7)
    for (let i = 0; i < 100; i++) {
      const value = random()
      expect(value).toBeGreaterThanOrEqual(0)
      expect(value).toBeLessThan(1)
    }
  })
})

describe('createPerlin2D', () => {
  it('is deterministic per seed', () => {
    const a = createPerlin2D(42)
    const b = createPerlin2D(42)
    expect(a(12.5, 7.25)).toBe(b(12.5, 7.25))
  })

  it('differs across seeds and stays in range', () => {
    const a = createPerlin2D(1)
    const b = createPerlin2D(2)
    expect(a(3.25, 9.75)).not.toBe(b(3.25, 9.75))
    for (let x = -8; x <= 8; x += 0.5) {
      for (let y = -8; y <= 8; y += 0.5) {
        // Contract: the √2 output scaling stretches 2D peaks to about ±√2
        const value = a(x, y)
        expect(value).toBeGreaterThanOrEqual(-1.5)
        expect(value).toBeLessThanOrEqual(1.5)
      }
    }
  })

  it('is exactly zero on integer lattice points', () => {
    expect(createPerlin2D(9)(4, -2)).toBe(0)
  })
})

describe('createPerlin3D', () => {
  it('is deterministic per seed and seed-sensitive', () => {
    const a = createPerlin3D(7)
    const b = createPerlin3D(7)
    expect(a(1.5, 2.5, 3.5)).toBe(b(1.5, 2.5, 3.5))
    expect(a(1.5, 2.5, 3.5)).not.toBe(createPerlin3D(8)(1.5, 2.5, 3.5))
  })

  it('stays in range and is zero on lattice points', () => {
    const noise = createPerlin3D(7)
    for (let x = -4; x <= 4; x += 0.5) {
      for (let y = -4; y <= 4; y += 0.5) {
        for (let z = -4; z <= 4; z += 0.5) {
          const value = noise(x, y, z)
          expect(value).toBeGreaterThanOrEqual(-1)
          expect(value).toBeLessThanOrEqual(1)
        }
      }
    }
    expect(noise(4, -2, 9)).toBe(0)
  })
})

describe('fbm', () => {
  it('validates octaves', () => {
    const noise = createPerlin2D(1)
    expect(() => fbm(noise, 0, 0, 0)).toThrow(RangeError)
    expect(() => fbm(noise, 0, 0, 1.5)).toThrow(RangeError)
  })

  it('degenerates to the base field with one octave', () => {
    const noise = createPerlin2D(3)
    expect(fbm(noise, 1.25, 8.5, 1)).toBe(noise(1.25, 8.5))
  })

  it('stays normalized over several octaves', () => {
    const noise = createPerlin2D(3)
    const value = fbm(noise, 12.5, 7.25, 5)
    expect(value).toBeGreaterThanOrEqual(-1.5)
    expect(value).toBeLessThanOrEqual(1.5)
  })
})

describe('fbm3D', () => {
  it('validates octaves like fbm', () => {
    const noise = createPerlin3D(1)
    expect(() => fbm3D(noise, 0, 0, 0, 0)).toThrow(RangeError)
  })

  it('is deterministic and normalized', () => {
    const value = fbm3D(createPerlin3D(7), 3.1, -2.2, 0.7, 4)
    expect(value).toBe(fbm3D(createPerlin3D(7), 3.1, -2.2, 0.7, 4))
    expect(value).toBeGreaterThanOrEqual(-1.1)
    expect(value).toBeLessThanOrEqual(1.1)
  })
})

describe('blendBiomes', () => {
  it('clamps out-of-range fields', () => {
    expect(blendBiomes({ elevation: 5, moisture: 9, temperature: -3 })).toBe(
      blendBiomes({ elevation: 1, moisture: 1, temperature: 0 }),
    )
  })

  it('raises mountains with moisture and softens with heat', () => {
    const dry = blendBiomes({ elevation: 0.5, moisture: 0, temperature: 0.5 })
    const wet = blendBiomes({ elevation: 0.5, moisture: 1, temperature: 0.5 })
    expect(wet).toBeGreaterThan(dry)
    const cold = blendBiomes({ elevation: 0.5, moisture: 0.5, temperature: 0 })
    const hot = blendBiomes({ elevation: 0.5, moisture: 0.5, temperature: 1 })
    expect(cold).toBeGreaterThan(hot)
  })
})
